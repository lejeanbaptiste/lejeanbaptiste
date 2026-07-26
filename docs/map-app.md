# MapLibre Disambiguation Map - Planning Document

> **Superseded 2026-07-26.** This document's architecture (Nominatim geocoding, generic tile sourcing, standalone phasing) has been superseded by **Phase 6** of [`placename-geo-disambiguation-planning.md`](placename-geo-disambiguation-planning.md) and its "Decisions (2026-07-26)" section. In particular: no Nominatim/geocoding (§2, §9.2, §12 below are no longer authoritative — coordinates come only from already-geocoded authority-pack data), and MapTiler is the chosen tile provider rather than a generic OSM/MapTiler/Thunderforest choice. This file is kept for its UI/UX detail (popup sizing, resize behavior, tooltip layout, pin/hover styling in §3, §6) which still applies. Treat `placename-geo-disambiguation-planning.md` as authoritative for scope, phasing, and data flow.

## 1. Overview

### 1.1 Purpose

Provide a visual disambiguation tool for place names within an XML editor. When a user encounters an ambiguous place name (e.g., "衡水" with multiple locations), this map viewer will display all candidate locations as pins on a MapLibre map, allowing the user to hover for details and click to select the correct one.

We'll also use the same infrastructure to show a map of disambiguated place names contained within the current document (future)

### 1.2 Scope

- Small popup map (≈1/4 screen by default)
- Resizable by user
- Displays multiple location candidates as pins
- Hover: Shows disambiguation info (position, years, admin boundaries)
- Click: Selects candidate, closes map, updates XML editor's review panel
- Non-GAFAM solution (MapLibre + Nominatim)

### 1.3 Users

- Researchers and editors working with historical/geographical XML documents
- Users who need to disambiguate place names with multiple possible locations

---



## 2. Technical Stack


| Component     | Technology                                                      | Purpose                                        |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| Map Rendering | MapLibre GL JS v2.x+                                            | Core map display and interaction               |
| Geocoding     | Nominatim (OSM)                                                 | Place name → coordinates conversion            |
| Base Layers   | OpenStreetMap (raster), optional: MapTiler/Thunderforest        | Street, satellite, and relief views            |
| Terrain       | AWS Terrain Tiles + maplibre-gl-terrain plugin                  | Elevation/relief visualization                 |
| UI Framework  | Vanilla JS/HTML/CSS or integrate with existing editor framework | Map container and controls                     |
| Data Storage  | XML attributes/elements                                         | Persist selected coordinates and place details |


---



## 3. Detailed Requirements



### 3.1 Map Display

- **Size**: Default to approximately 1/4 of the screen (e.g., 600x400px for a 1920x1080 display)
- **Resizability**: User can drag to resize the map popup; dimensions persist during session
- **Positioning**: Centered modal or anchored to the trigger element in the XML editor
- **Default View**: Automatically zoom and pan to fit all pins with padding (e.g., 20% margin)



### 3.2 Pins and Markers

- **Visual Style**: Distinctive pin icon (e.g., red marker with number for multi-candidate disambiguation)
- **Hover Effect**: Pin scales slightly and shows a tooltip with disambiguation info
- **Click Effect**: Pin highlights briefly, then triggers selection workflow



### 3.3 Disambiguation Information (Hover Tooltip)

The tooltip must display:

- **Primary name**: The place name being disambiguated (e.g., "衡水")
- **Full name**: Full administrative hierarchy (e.g., "衡水, Hebei, China")
- **Coordinates**: Latitude and longitude (e.g., "37.7349°N, 115.6886°E")
- **Contextual data**: Years of relevance, historical periods, or other metadata from the XML document
- **Source**: Geocoding source (e.g., "Nominatim/OSM")



### 3.4 Selection Workflow

1. User hovers over a pin → Tooltip appears with disambiguation info
2. User clicks a pin →
  - Map captures the selected candidate's data (coordinates, full name, metadata)
  - Map closes automatically
  - XML editor's review panel updates to show the selected candidate
  - Selected candidate is highlighted in the review panel



### 3.5 Layer Switching (Optional but Recommended)

- **Street View**: OpenStreetMap standard raster tiles
- **Satellite View**: Sentinel/USGS or other free satellite imagery
- **Relief View**: Terrain layer with elevation shading
- **UI**: Toggle buttons or dropdown menu in the map's top-right corner

---



## 4. Architecture



### 4.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      XML Editor UI                            │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │   Review Panel   │    │        Map Popup                  │  │
│  │  ┌─────────────┐ │    │  ┌─────────────────────────────┐ │  │
│  │  │Candidate List│ ←───┼─►│  MapLibre Map                 │ │  │
│  │  │             │ │    │  │  ┌─────┐  ┌─────┐  ┌─────┐  │ │  │
│  │  │             │ │    │  │  │Pin 1│  │Pin 2│  │Pin 3│  │ │  │
│  │  │             │ │    │  │  └─────┘  └─────┘  └─────┘  │ │  │
│  │  └─────────────┘ │    │  └─────────────────────────────┘ │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Nominatim API  │
                    │  (Geocoding)    │
                    └─────────────────┘
```



### 4.2 Data Flow

**Trigger → Selection:**

1. User triggers disambiguation (e.g., right-clicks ambiguous place name in XML)
2. XML editor extracts place name and any contextual metadata (years, etc.)
3. Editor sends place name to Nominatim API
4. Nominatim returns array of candidate locations with coordinates and metadata
5. Editor initializes MapLibre map with candidates as GeoJSON points
6. Map renders, auto-fits to all pins
7. User hovers/clicks pins to preview/select
8. On selection: Map closes, editor updates XML with selected candidate's data

**XML Storage Format:**

```xml
<place name="衡水" disambiguated="true">
  <geo lat="37.7349" lon="115.6886" />
  <fullName>衡水, Hebei, China</fullName>
  <context years="1920-1945" />
  <source>Nominatim/OSM</source>
</place>
```

---



## 5. Implementation Plan



### Phase 1: Core Map Integration (1-2 days)

- [ ] Set up MapLibre GL JS in the XML editor project
- [ ] Create popup container with resizable functionality
- [ ] Implement basic map initialization
- [ ] Add pin markers from GeoJSON data
- [ ] Implement auto-fit to all pins on load

**Deliverable**: Functional map displaying static pins

### Phase 2: Geocoding Integration (1 day)

- [ ] Integrate Nominatim API for place name → coordinates
- [ ] Parse Nominatim response into GeoJSON format
- [ ] Handle API errors and no-results cases
- [ ] Add proper User-Agent header

**Deliverable**: Map dynamically populates with candidates from place name

### Phase 3: Hover Tooltips (1 day)

- [ ] Create tooltip component with disambiguation info
- [ ] Implement hover detection on pins
- [ ] Style tooltip with position, years, admin info
- [ ] Ensure tooltip positioning doesn't go off-screen

**Deliverable**: Hovering pins shows rich disambiguation info

### Phase 4: Selection Workflow (1 day)

- [ ] Implement click handler on pins
- [ ] Capture selected candidate data
- [ ] Close map on selection
- [ ] Update XML editor's review panel
- [ ] Highlight selected candidate in review panel

**Deliverable**: Full disambiguation workflow

### Phase 5: Polish (1 day)

- [ ] Add layer switching (street/satellite/relief)
- [ ] Implement smooth animations for zoom/pan
- [ ] Add loading states
- [ ] Improve visual styling of pins and tooltips
- [ ] Ensure mobile/tablet compatibility

**Deliverable**: Production-ready disambiguation map

---



## 6. UI/UX Specifications



### 6.1 Map Popup

- **Background**: Semi-transparent overlay behind map
- **Border**: 1px solid #ccc, rounded corners (4px)
- **Shadow**: Drop shadow for depth (e.g., `0 4px 12px rgba(0,0,0,0.15)`)
- **Resize Handle**: Bottom-right corner grip for resizing
- **Close Button**: Top-right 'X' button to cancel without selection



### 6.2 Pins

- **Default State**: Red marker icon (⚫ or custom SVG)
- **Hover State**: Blue marker with scale animation (1.2x)
- **Size**: 24x24px icons
- **Number Badges**: If >1 candidate, show count (e.g., "1", "2", "3") on pins



### 6.3 Tooltip

- **Position**: Above pin, with arrow pointing down
- **Style**: White background, rounded corners, subtle shadow
- **Content Layout**:
  ```
  衡水 (Hengshui)
  ─────────────
  Location: 衡水, Hebei, China
  Coordinates: 37.7349°N, 115.6886°E
  Years: 1920-1945
  Source: OpenStreetMap
  ```
- **Animation**: Fade in/out (200ms)



### 6.4 Layer Switcher

- **Position**: Top-right of map (standard location)
- **Style**: Compact button group or dropdown
- **Icons**: Visual icons for each layer type (🗺️ street, 🛰️ satellite, ⛰️ relief)

---



## 7. Error Handling


| Scenario                     | Handling                                        |
| ---------------------------- | ----------------------------------------------- |
| Nominatim returns no results | Show "No locations found" message in map center |
| Nominatim rate limit hit     | Show retry button with delay timer              |
| Network error                | Show offline indicator and retry button         |
| Map fails to load            | Fallback to simple list view of candidates      |
| Invalid coordinates          | Skip invalid entries, log to console            |
| User cancels (closes map)    | No action; return to editor without selection   |


---



## 8. Testing Strategy



### 8.1 Test Cases

- [ ] Single candidate place name
- [ ] Multiple candidates (e.g., "Springfield", "衡水")
- [ ] Place name with no results
- [ ] Network interruption during geocoding
- [ ] Rapid successive disambiguation requests
- [ ] Map resizing (drag, window resize)
- [ ] Hover on edge of screen (tooltip positioning)
- [ ] Layer switching between street/satellite/relief
- [ ] Mobile touch interactions



### 8.2 Validation

- Verify all pins are visible when map auto-fits
- Verify selected candidate data is correctly stored in XML
- Verify review panel updates correctly after selection
- Verify map closes properly after selection

---



## 9. Dependencies



### 9.1 External Libraries

- MapLibre GL JS: `npm install maplibre-gl` or CDN
- Optional: `maplibre-gl-terrain` plugin for relief view
- Optional: `leaflet` (fallback if MapLibre proves too heavy)



### 9.2 APIs

- ~~Nominatim: `https://nominatim.openstreetmap.org/search` (no API key required)~~ — **superseded, not used.** See note at top of document: coordinates come only from already-compiled authority-pack geo data, never from live geocoding.



### 9.3 Data Sources

- ~~OpenStreetMap raster tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`~~ — **superseded.** `tile.openstreetmap.org`'s usage policy prohibits third-party/redistributed-app bulk use. **Chosen approach: local MBTiles**, downloaded once by the user on first map open (street/satellite/relief bundle, capped ~500 MB, regional coverage), served locally via a bundled tile server (e.g. `tileserver-gl`) — no API key, no ongoing external requests, works offline. MapTiler is a documented fallback only for areas outside the bundled region. See Phase 6 / "Decisions (2026-07-26)" in `placename-geo-disambiguation-planning.md`.
- ~~AWS Terrain Tiles: `https://demotiles.maplibre.org/terrain/{z}/{x}/{y}.png` (or similar)~~ — this was MapLibre's demo tileset, not a real terrain source. Relief comes from the same local MBTiles bundle above.

---



## 10. Risks and Mitigations


| Risk                        | Probability | Impact | Mitigation                                                      |
| --------------------------- | ----------- | ------ | --------------------------------------------------------------- |
| Nominatim downtime          | Low         | High   | Cache previous results; implement retry logic                   |
| Rate limiting               | Low         | Medium | Use proper User-Agent; add delays between requests              |
| MapLibre performance issues | Medium      | Medium | Optimize GeoJSON; limit number of pins; test on target devices  |
| Browser compatibility       | Low         | Medium | Use polyfills for older browsers; test on Chrome/Firefox/Safari |
| XML integration complexity  | Medium      | High   | Design clean interface between map and editor                   |


---



## 11. Open Questions

1. **XML Integration**: How does the XML editor currently handle place name data? Is there an existing schema for geographical metadata?
2. **Contextual Data**: What specific metadata (years, periods, etc.) should be included in the hover tooltip?
3. **Multiple Selections**: Should the map support selecting multiple candidates in one session (e.g., for batch disambiguation)?
4. **History**: Should previously disambiguated places be cached or highlighted differently?
5. **Keyboard Navigation**: Should the map support keyboard-only interaction for accessibility?

---



## 12. Appendix: Code Snippets



### Basic MapLibre Initialization

```javascript
// Initialize map
const map = new maplibregl.Map({
  container: 'disambiguation-map',
  style: 'https://demotiles.maplibre.org/style.json', // OSM-based style
  center: [0, 0], // Will be overridden by fitBounds
  zoom: 2
});

// Add GeoJSON source with candidates
map.on('load', () => {
  map.addSource('candidates', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: candidates.map(c => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { name: c.display_name, years: c.years, ...c.metadata }
      }))
    }
  });

  // Add layer for pins
  map.addLayer({
    id: 'candidates-layer',
    type: 'circle',
    source: 'candidates',
    paint: { 'circle-radius': 8, 'circle-color': '#ff0000' }
  });

  // Fit to all pins
  const bounds = new maplibregl.LngLatBounds();
  candidates.forEach(c => bounds.extend([c.lon, c.lat]));
  map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
});
```



### Nominatim Query

```javascript
async function geocodePlaceName(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'MyXMLEditor/1.0' } }
  );
  return await response.json();
}
```



### Hover Tooltip

```javascript
map.on('mousemove', 'candidates-layer', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['candidates-layer'] });
  if (features.length > 0) {
    const props = features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="tooltip">
          <strong>${props.name}</strong>
          <hr>
          <small>${props.fullName}</small><br>
          <small>Lat: ${props.lat}, Lon: ${props.lon}</small><br>
          <small>Years: ${props.years || 'N/A'}</small>
        </div>
      `)
      .addTo(map);
  }
});
```

---

*Document Status: Draft*
*Last Updated: July 26, 2026*
*Owner: Daniel MORGAN / CNRS*
