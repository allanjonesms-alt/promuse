import React, { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export default function AddressInput({ 
  value, 
  onChange, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void;
  className?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    
    // Using classic Autocomplete from Places library
    autocompleteRef.current = new placesLib.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'name'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address);
      } else if (place && place.name) {
        onChange(place.name);
      }
    });

    // Cleanup not strictly necessary for this instance but good practice
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [placesLib, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Rua, número, bairro e cidade"
      className={className}
    />
  );
}
