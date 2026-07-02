import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { AlertTriangle, MapPin } from 'lucide-react';

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
  onCoordinatesChange,
  className 
}: { 
  value: string; 
  onChange: (val: string) => void;
  onCoordinatesChange?: (coords: { latitude: number; longitude: number } | null) => void;
  className?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Keep latest handlers in refs to avoid recreating autocomplete listeners on parent state changes
  const onChangeRef = useRef(onChange);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCoordinatesChangeRef.current = onCoordinatesChange;
  });

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
          onCoordinatesChangeRef.current({
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng()
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

  return (
    <div className="w-full space-y-1.5">
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
    </div>
  );
}
