/**
 * Stands in for `maplibre-gl` under jest.
 *
 * The package is ESM-only, so jest's CJS resolver cannot reach it at all — any
 * test whose import graph touches PlaceComparisonMap failed to resolve, which
 * includes components several levels away that never open a map. Mapping it here
 * means those tests do not each need a `{ virtual: true }` mock.
 *
 * Tests that actually exercise map behaviour still declare their own
 * `jest.mock('maplibre-gl', …)` with assertions; an explicit factory takes
 * precedence over this mapping.
 */

export class Map {
  on() {}
  off() {}
  remove() {}
  setStyle() {}
  setMaxZoom() {}
  setMaxBounds() {}
  jumpTo() {}
  fitBounds() {}
  getCenter() {
    return { lat: 0, lng: 0 };
  }
}

export class Marker {
  setLngLat() {
    return this;
  }
  setPopup() {
    return this;
  }
  addTo() {
    return this;
  }
  remove() {}
}

export class Popup {
  setHTML() {
    return this;
  }
}

export class LngLatBounds {
  extend() {
    return this;
  }
}

export const setWorkerUrl = () => undefined;

export type StyleSpecification = unknown;
export { Map as MapLibreMap };
