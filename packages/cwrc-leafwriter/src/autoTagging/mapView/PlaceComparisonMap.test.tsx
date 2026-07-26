import { render, screen } from '@testing-library/react';
import { PlaceComparisonMap, type MapPin } from './PlaceComparisonMap';

const mockFitBounds = jest.fn();
const mockJumpTo = jest.fn();
const mockAddTo = jest.fn();
const mockSetLngLat = jest.fn();
const mockSetPopup = jest.fn();
const mockRemove = jest.fn();
const mockMarkerRemove = jest.fn();
const mockExtend = jest.fn();

let onLoadCallback: (() => void) | null = null;

jest.mock('maplibre-gl', () => {
  class MockMap {
    constructor(public options: unknown) {}
    on(event: string, cb: () => void) {
      if (event === 'load') onLoadCallback = cb;
    }
    fitBounds(...args: unknown[]) {
      mockFitBounds(...args);
    }
    jumpTo(...args: unknown[]) {
      mockJumpTo(...args);
    }
    remove() {
      mockRemove();
    }
  }
  class MockMarker {
    setLngLat(...args: unknown[]) {
      mockSetLngLat(...args);
      return this;
    }
    setPopup(...args: unknown[]) {
      mockSetPopup(...args);
      return this;
    }
    addTo(...args: unknown[]) {
      mockAddTo(...args);
      return this;
    }
    remove() {
      mockMarkerRemove();
    }
  }
  class MockPopup {
    setHTML() {
      return this;
    }
  }
  class MockLngLatBounds {
    extend(...args: unknown[]) {
      mockExtend(...args);
      return this;
    }
  }
  return {
    __esModule: true,
    MapLibreMap: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    LngLatBounds: MockLngLatBounds,
  };
}, { virtual: true });

function makePin(overrides: Partial<MapPin> = {}): MapPin {
  return {
    id: 'cbdb:a',
    label: 'A',
    color: '#d32f2f',
    lat: 30.65,
    lon: 113.15,
    sources: ['CBDB', 'CHGIS'],
    ...overrides,
  };
}

describe('PlaceComparisonMap', () => {
  afterEach(() => {
    jest.clearAllMocks();
    onLoadCallback = null;
  });

  it('creates one marker per pin and fits bounds to all of them once the map loads', () => {
    const pins = [makePin({ id: 'a', lat: 30.65, lon: 113.15 }), makePin({ id: 'b', lat: 39.9, lon: 116.4 })];
    render(
      <PlaceComparisonMap open pins={pins} title="竟陵 — compare clusters" onClose={jest.fn()} />,
    );

    onLoadCallback?.();

    expect(mockSetLngLat).toHaveBeenCalledTimes(2);
    expect(mockAddTo).toHaveBeenCalledTimes(2);
    expect(mockExtend).toHaveBeenCalledTimes(2);
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
    expect(mockJumpTo).not.toHaveBeenCalled();
  });

  it('jumps to the single pin instead of fitting bounds when there is only one', () => {
    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);

    onLoadCallback?.();

    expect(mockJumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: [113.15, 30.65] }));
    expect(mockFitBounds).not.toHaveBeenCalled();
  });

  it('renders the dialog title and closes via the close button', () => {
    const onClose = jest.fn();
    render(<PlaceComparisonMap open pins={[makePin()]} title="竟陵 — compare clusters" onClose={onClose} />);

    expect(screen.getByText('竟陵 — compare clusters')).toBeTruthy();
    screen.getByLabelText('Close map').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tears down the map and its markers on unmount', () => {
    const { unmount } = render(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );
    onLoadCallback?.();

    unmount();

    expect(mockMarkerRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
