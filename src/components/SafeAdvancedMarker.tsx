import React, { useState, useEffect } from 'react';
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

export function SafeAdvancedMarker(props: React.ComponentProps<typeof AdvancedMarker>) {
  const map = useMap();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!map) {
      setIsReady(false);
      return;
    }

    let active = true;

    // Safety patch: ensure getDiv on the map object never returns undefined
    if (typeof map.getDiv === 'function') {
      const originalGetDiv = map.getDiv.bind(map);
      map.getDiv = () => {
        const div = originalGetDiv();
        if (!div) {
          return document.createElement('div');
        }
        return div;
      };
    }

    const checkDivReady = () => {
      if (!active) return;
      try {
        if (typeof map.getDiv === 'function' && Boolean(map.getDiv())) {
          setIsReady(true);
        } else {
          setTimeout(checkDivReady, 50);
        }
      } catch {
        setTimeout(checkDivReady, 100);
      }
    };

    checkDivReady();

    return () => {
      active = false;
    };
  }, [map]);

  if (!map || !isReady) {
    return null;
  }

  return <AdvancedMarker {...props} />;
}
