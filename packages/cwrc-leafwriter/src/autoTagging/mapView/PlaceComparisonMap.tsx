import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useRef, useState } from 'react';
import {
  LngLatBounds,
  MapLibreMap,
  Marker,
  Popup,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { layers as protomapsLayers, namedFlavor } from '@protomaps/basemaps';
import { findBundleForPoint, lngLatBoundsLike, REGIONAL_BUNDLES } from './regionalBundles';

// MapLibre computes its worker's URL from `import.meta.url` at the moment it
// first needs a worker (lazily, inside an async callback — not at module
// top-level). Webpack's `import.meta.url` polyfill falls back to
// `document.currentScript`, which is only set during synchronous top-level
// script execution; by the time MapLibre actually needs a worker, it's
// long gone, and the polyfill's further fallback (scanning for the last
// <script> tag) can land on some other dynamically-injected script in this
// editor (Monaco, TinyMCE, etc.) — one with no real `src`. The result is
// `new Worker('', { type: 'module' })`, a worker that runs no code at all:
// no top-level execution, no message handling, no tile fetches, forever.
// `maplibre-gl-worker.mjs` is served at the app root by
// apps/commons/webpack.config.ts's CopyWebpackPlugin pattern — point
// straight at it instead of trusting the auto-detected URL.
setWorkerUrl('/maplibre-gl-worker.mjs');

/**
 * A single pin to compare on the map. Deliberately generic — not
 * `DisambiguationCandidate`/`MentionGroup` — so this component can later
 * serve the document-wide "map of disambiguated places" view
 * (docs/archive/map-app.md §1.1) without a rewrite. `color`/`label` should match
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
  /** Every candidate id in this pin's cluster (id is just the first member). */
  memberIds: string[];
}

export interface PlaceComparisonMapProps {
  open: boolean;
  onClose: () => void;
  pins: MapPin[];
  title: string;
  /** Resolve this pin's cluster — mirrors accepting the selected candidates (Enter). */
  onPinClick?: (pin: MapPin) => void;
}

/**
 * Blank style used until a local PMTiles regional bundle covering the current
 * view is installed (Phase 6, WP5 — see
 * docs/placename-geo-disambiguation-planning.md). Pins still render and are
 * still comparable by relative position even without basemap tiles
 * underneath — per the Phase 6 acceptance criterion that declining/lacking
 * the tile download must not block disambiguation.
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

/**
 * Which local name to render for place/city/province labels, per installed
 * region — matches REGIONAL_BUNDLES' `languages` (regionalBundles.ts).
 * Everything here is Han-script text either way (this tool works with
 * Traditional/Classical Chinese sources), so China and Tibet share a
 * language; @protomaps/basemaps has no dedicated Tibetan entry.
 *
 * Script is not passed explicitly: `layers()` derives it from the language
 * (zh-Hant → Han, ja → Han/Hiragana/Katakana), producing exactly the label
 * expressions the old `protomaps-themes-base(source, theme, lang, script)`
 * signature did.
 */
const LABEL_LANG_BY_BUNDLE: Record<string, string> = {
  china: 'zh-Hant',
  tibet: 'zh-Hant',
  japan: 'ja',
};
const DEFAULT_LABEL_LANG = 'zh-Hant';
const MAP_TILE_MAX_ZOOM = 15;

/**
 * Real vector basemap once a local PMTiles regional bundle is installed,
 * served entirely in-process by apps/desktop/src/mapTiles.ts's
 * `pmtiles://<bundleId>/...` protocol handler (must match its PMTILES_SCHEME
 * constant) — no network request, no local HTTP server. Uses Protomaps'
 * official "light" theme with city/province/place labels (glyphs served
 * locally too — see apps/commons/scripts/download-glyphs.mjs and its
 * webpack.config.ts CopyWebpackPlugin pattern — so labels work fully
 * offline, same as the tiles themselves), swapped in after the map already
 * exists (see `map.setStyle` below) rather than chosen up front, so pins
 * never wait on this check.
 */
function vectorStyle(bundleId: string, maxZoom = MAP_TILE_MAX_ZOOM): StyleSpecification {
  const lang = LABEL_LANG_BY_BUNDLE[bundleId] ?? DEFAULT_LABEL_LANG;
  return {
    version: 8,
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [`pmtiles://${bundleId}/{z}/{x}/{y}.mvt`],
        maxzoom: maxZoom,
      },
    },
    layers: protomapsLayers('protomaps', namedFlavor('light'), {
      lang,
    }) as StyleSpecification['layers'],
  };
}

function centroidOfPins(pins: MapPin[]): { lat: number; lon: number } | null {
  if (pins.length === 0) return null;
  const lat = pins.reduce((sum, p) => sum + p.lat, 0) / pins.length;
  const lon = pins.reduce((sum, p) => sum + p.lon, 0) / pins.length;
  return { lat, lon };
}

export function PlaceComparisonMap({
  open,
  onClose,
  pins,
  title,
  onPinClick,
}: PlaceComparisonMapProps) {
  // Read via a ref inside the marker click listener so the map-mount effect
  // below (keyed on [open, container, pins]) doesn't need onPinClick in its
  // deps — a fresh callback identity from the parent must not tear down and
  // rebuild the whole MapLibre map.
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  // MUI's Dialog mounts its Portal content in a commit after the initial
  // render, so a plain useRef's `.current` isn't populated yet the first
  // time an effect keyed on `open` runs. A state-backed callback ref
  // re-renders (and re-runs the effect) once the container div actually
  // attaches, regardless of how many passes the Dialog/Portal takes.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [showRegionWarning, setShowRegionWarning] = useState(false);

  useEffect(() => {
    if (!open || !container) return;
    let cancelled = false;
    let installedBundleIds: string[] = [];

    const map = new MapLibreMap({
      container,
      style: blankStyle(),
      center: [0, 0],
      zoom: 2,
      maxZoom: MAP_TILE_MAX_ZOOM,
      // Regional PMTiles only cover their extract bbox — don't wrap the world
      // or let the camera drift into empty ocean beyond downloaded tiles.
      renderWorldCopies: false,
      attributionControl: false,
    });
    mapRef.current = map;

    const isCovered = (lat: number, lon: number) =>
      installedBundleIds.some((id) => {
        const bundle = REGIONAL_BUNDLES.find((b) => b.id === id);
        return bundle && findBundleForPoint([bundle], lat, lon) != null;
      });

    // Used once the camera has actually settled (e.g. after the user pans),
    // when map.getCenter() reflects where they're actually looking.
    const updateRegionWarning = () => {
      const { lat, lng } = map.getCenter();
      setShowRegionWarning(!isCovered(lat, lng));
    };

    // Pins render immediately against the blank style; the real basemap (if
    // a bundle covering these pins is installed) swaps in afterward without
    // disturbing markers, which live outside the style. A declined/missing
    // download just leaves the blank background — never blocks comparing
    // pins.
    window.electronAPI
      ?.mapTilesStatus?.()
      .then((status) => {
        if (cancelled) return;
        installedBundleIds = status?.regions?.map((r) => r.id) ?? [];

        const centroid = centroidOfPins(pins);
        const installedBundles = REGIONAL_BUNDLES.filter((bundle) =>
          installedBundleIds.includes(bundle.id),
        );
        const matchingInstalled =
          centroid && findBundleForPoint(installedBundles, centroid.lat, centroid.lon);
        if (matchingInstalled) {
          // Cap camera zoom to the installed archive's max zoom (regional extracts
          // are often z≤8 even though full Protomaps goes to 15).
          const regionMeta = status?.regions?.find((r) => r.id === matchingInstalled.id);
          const tileMaxZoom =
            typeof regionMeta?.maxZoom === 'number' && regionMeta.maxZoom >= 0
              ? Math.min(regionMeta.maxZoom, MAP_TILE_MAX_ZOOM)
              : MAP_TILE_MAX_ZOOM;
          map.setMaxZoom(tileMaxZoom);
          map.setStyle(vectorStyle(matchingInstalled.id, tileMaxZoom));
          // Keep pan/zoom inside the tile extract so users can't leave coverage.
          map.setMaxBounds(lngLatBoundsLike(matchingInstalled.bounds));
        }

        // Checked against the pins' own location, not map.getCenter(): at
        // this point the camera may still be sitting at its [0, 0] initial
        // position (jumpTo/fitBounds hasn't run yet, since that happens in
        // the 'load' handler below), so reading it here would misreport an
        // installed region as uncovered.
        setShowRegionWarning(centroid ? !isCovered(centroid.lat, centroid.lon) : false);
      })
      .catch(() => undefined);

    map.on('moveend', updateRegionWarning);

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
        el.style.cursor = onPinClickRef.current ? 'pointer' : '';
        el.addEventListener('click', () => onPinClickRef.current?.(pin));

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
      cancelled = true;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [open, container, pins]);

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
        {showRegionWarning && (
          <Typography
            variant="caption"
            sx={{ display: 'block', color: 'error.main', px: 1, py: 0.5, bgcolor: 'error.light' }}
          >
            This region isn't downloaded. Go to Settings to download maps.
          </Typography>
        )}
        <div ref={setContainer} style={{ width: '100%', height: 400 }} />
      </DialogContent>
    </Dialog>
  );
}
