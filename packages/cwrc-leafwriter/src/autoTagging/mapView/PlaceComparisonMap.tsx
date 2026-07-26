import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, MapLibreMap, Marker, Popup, type StyleSpecification } from 'maplibre-gl';

/**
 * A single pin to compare on the map. Deliberately generic — not
 * `DisambiguationCandidate`/`MentionGroup` — so this component can later
 * serve the document-wide "map of disambiguated places" view
 * (docs/map-app.md §1.1) without a rewrite. `color`/`label` should match
 * whatever cluster badge the caller already showed elsewhere (row chips,
 * group-header icon) so the map and the list read as one visual system.
 */
export interface MapPin {
  id: string;
  label: string;
  color: string;
  lat: number;
  lon: number;
  sources: string[];
  description?: string;
}

export interface PlaceComparisonMapProps {
  open: boolean;
  onClose: () => void;
  pins: MapPin[];
  title: string;
}

/**
 * Blank style used until the local MBTiles tile-serving protocol (Phase 6,
 * WP5 — see docs/placename-geo-disambiguation-planning.md) is registered.
 * Pins still render and are still comparable by relative position even
 * without basemap tiles underneath — per the Phase 6 acceptance criterion
 * that declining/lacking the tile download must not block disambiguation.
 */
function blankStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e8eaed' },
      },
    ],
  };
}

export function PlaceComparisonMap({ open, onClose, pins, title }: PlaceComparisonMapProps) {
  // MUI's Dialog mounts its Portal content in a commit after the initial
  // render, so a plain useRef's `.current` isn't populated yet the first
  // time an effect keyed on `open` runs. A state-backed callback ref
  // re-renders (and re-runs the effect) once the container div actually
  // attaches, regardless of how many passes the Dialog/Portal takes.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!open || !container) return;

    const map = new MapLibreMap({
      container,
      style: blankStyle(),
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      if (pins.length === 0) return;

      for (const pin of pins) {
        const el = document.createElement('div');
        el.setAttribute('data-testid', `map-pin-${pin.id}`);
        Object.assign(el.style, {
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: pin.color,
          border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          color: '#fff',
          fontSize: '10px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        });
        el.textContent = pin.label;

        const popupHtml = [
          `<strong>${pin.label}</strong>`,
          pin.description ? `<div>${pin.description}</div>` : '',
          `<div>${pin.sources.join(' · ')}</div>`,
        ]
          .filter(Boolean)
          .join('');

        const marker = new Marker({ element: el })
          .setLngLat([pin.lon, pin.lat])
          .setPopup(new Popup({ offset: 16 }).setHTML(popupHtml))
          .addTo(map);
        markersRef.current.push(marker);
      }

      if (pins.length === 1) {
        map.jumpTo({ center: [pins[0]!.lon, pins[0]!.lat], zoom: 8 });
      } else {
        const bounds = new LngLatBounds();
        for (const pin of pins) bounds.extend([pin.lon, pin.lat]);
        map.fitBounds(bounds, { padding: 48, maxZoom: 12 });
      }
    });

    return () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pins/title only need to seed the map on open
  }, [open, container]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close map">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <div ref={setContainer} style={{ width: '100%', height: 400 }} />
      </DialogContent>
    </Dialog>
  );
}
