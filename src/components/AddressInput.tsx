import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { AlertTriangle, MapPin, Compass } from 'lucide-react';

const ALLOWED_CITIES = [
  'coxim',
  'alcinópolis',
  'alcinopolis',
  'pedro gomes',
  'sonora',
  'rio verde de mato grosso',
  'rio verde de mt',
  'rio verde'
];

export function validateAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || !address.trim()) {
    return { isValid: true };
  }

  const normalized = address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Check if State is MS (Mato Grosso do Sul)
  const hasMS = normalized.includes('ms') || normalized.includes('mato grosso do sul');
  if (!hasMS) {
    return {
      isValid: false,
      error: 'O endereço precisa ser no estado de Mato Grosso do Sul (MS).'
    };
  }

  // Check if City is one of the allowed 5 cities
  const matched = ALLOWED_CITIES.some(city => normalized.includes(city));
  if (!matched) {
    return {
      isValid: false,
      error: 'Permitido apenas: Coxim, Alcinópolis, Pedro Gomes, Sonora ou Rio Verde de MT.'
    };
  }

  return { isValid: true };
}

export default function AddressInput({ 
  value, 
  onChange, 
  coordinates,
  onCoordinatesChange,
  className 
}: { 
  value: string; 
  onChange: (val: string) => void;
  coordinates?: { latitude: number; longitude: number } | null;
  onCoordinatesChange?: (coords: { latitude: number; longitude: number } | null) => void;
  className?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const defaultCenter = { lat: -18.5069, lng: -54.7601 }; // Coxim, MS
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(defaultCenter);

  // Keep latest handlers in refs to avoid recreating autocomplete listeners on parent state changes
  const onChangeRef = useRef(onChange);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCoordinatesChangeRef.current = onCoordinatesChange;
  });

  // Sync prop coordinates to mapCenter on load or when prop updates
  useEffect(() => {
    if (coordinates) {
      setMapCenter({ lat: coordinates.latitude, lng: coordinates.longitude });
    }
  }, [coordinates]);

  // Validate on value changes
  useEffect(() => {
    const check = validateAddress(value);
    if (!check.isValid && check.error) {
      setValidationError(check.error);
    } else {
      setValidationError(null);
    }
  }, [value]);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    
    // Bounds enclosing the 5 northern MS cities: Coxim, Alcinópolis, Pedro Gomes, Sonora, Rio Verde de MT
    const bounds = {
      south: -19.5,
      west: -55.5,
      north: -17.0,
      east: -53.0
    };

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['address_components', 'formatted_address', 'name', 'geometry'],
      componentRestrictions: { country: 'br' },
      bounds: bounds,
      strictBounds: true,
    });
    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const address = place?.formatted_address || place?.name || '';
      
      if (onChangeRef.current) {
        onChangeRef.current(address);
      }

      if (onCoordinatesChangeRef.current) {
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setMapCenter({ lat, lng });
          onCoordinatesChangeRef.current({
            latitude: lat,
            longitude: lng
          });
        } else {
          onCoordinatesChangeRef.current(null);
        }
      }
    });

    // Cleanup listeners correctly
    return () => {
      google.maps.event.removeListener(listener);
      autocompleteRef.current = null;
    };
  }, [placesLib]);

  const handleMapClick = (e: any) => {
    let lat: number | undefined;
    let lng: number | undefined;
    
    if (e.detail?.latLng) {
      lat = e.detail.latLng.lat;
      lng = e.detail.latLng.lng;
    } else if (e.latLng) {
      lat = typeof e.latLng.lat === 'function' ? e.latLng.lat() : e.latLng.lat;
      lng = typeof e.latLng.lng === 'function' ? e.latLng.lng() : e.latLng.lng;
    }
    
    if (lat !== undefined && lng !== undefined) {
      if (onCoordinatesChangeRef.current) {
        onCoordinatesChangeRef.current({ latitude: lat, longitude: lng });
      }
    }
  };

  const handleMarkerDragEnd = (e: any) => {
    let lat: number | undefined;
    let lng: number | undefined;
    
    if (e.latLng) {
      lat = typeof e.latLng.lat === 'function' ? e.latLng.lat() : e.latLng.lat;
      lng = typeof e.latLng.lng === 'function' ? e.latLng.lng() : e.latLng.lng;
    }
    
    if (lat !== undefined && lng !== undefined) {
      if (onCoordinatesChangeRef.current) {
        onCoordinatesChangeRef.current({ latitude: lat, longitude: lng });
      }
    }
  };

  // Show map only if there is a typed value
  const showMap = value && value.trim().length > 0;

  return (
    <div className="w-full space-y-2.5">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rua, número, bairro e cidade"
          className={className}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          <MapPin className="w-4 h-4" />
        </div>
      </div>
      
      {validationError && (
        <span className="text-[11px] text-rose-400 font-bold flex items-center gap-1.5 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          {validationError}
        </span>
      )}

      {showMap && (
        <div className="mt-3 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-2 shadow-inner">
          <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 font-bold">
              <MapPin className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
              AJUSTE FINO DO ENDEREÇO
            </span>
            <span className="text-[9px] text-slate-500">Arraste o PIN ou clique no mapa para posicionar</span>
          </div>
          <div className="h-[220px] rounded-lg overflow-hidden relative">
            <GoogleMap
              key={`${mapCenter.lat}-${mapCenter.lng}`}
              defaultZoom={15}
              defaultCenter={mapCenter}
              mapId="address-pin-map"
              disableDefaultUI={true}
              gestureHandling="greedy"
              onClick={handleMapClick}
              className="w-full h-full"
              internalUsageAttributionIds="gmp_mcp_codeassist_v1_aistudio"
            >
              {coordinates ? (
                <AdvancedMarker
                  position={{ lat: coordinates.latitude, lng: coordinates.longitude }}
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                >
                  <Pin
                    background="#ef4444"
                    borderColor="#b91c1c"
                    glyphColor="#fff"
                  />
                </AdvancedMarker>
              ) : (
                <AdvancedMarker
                  position={mapCenter}
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                >
                  <Pin
                    background="#ef4444"
                    borderColor="#b91c1c"
                    glyphColor="#fff"
                  />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </div>
        </div>
      )}
    </div>
  );
}
