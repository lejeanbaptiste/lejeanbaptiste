import { act, render, screen } from '@testing-library/react';
import { PlaceComparisonMap, type MapPin } from './PlaceComparisonMap';

const mockFitBounds = jest.fn();
const mockJumpTo = jest.fn();
const mockAddTo = jest.fn();
const mockSetLngLat = jest.fn();
const mockSetPopup = jest.fn();
const mockRemove = jest.fn();
const mockMarkerRemove = jest.fn();
const mockExtend = jest.fn();
const mockSetStyle = jest.fn();
const mockSetMaxBounds = jest.fn();
const mockSetMaxZoom = jest.fn();

let onLoadCallback: (() => void) | null = null;
let mockCenter = { lat: 30.65, lng: 113.15 };
let mockMapOptions: unknown = null;

jest.mock(
  'maplibre-gl',
  () => {
    class MockMap {
      constructor(public options: unknown) {
        mockMapOptions = options;
      }
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
      setStyle(...args: unknown[]) {
        mockSetStyle(...args);
      }
      setMaxBounds(...args: unknown[]) {
        mockSetMaxBounds(...args);
      }
      setMaxZoom(...args: unknown[]) {
        mockSetMaxZoom(...args);
      }
      getCenter() {
        return mockCenter;
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
      setWorkerUrl: jest.fn(),
    };
  },
  { virtual: true },
);

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
    mockCenter = { lat: 30.65, lng: 113.15 };
    mockMapOptions = null;
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  it('limits map zoom to the maximum zoom supported by the tile source', () => {
    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);

    expect(mockMapOptions).toEqual(
      expect.objectContaining({ maxZoom: 15, renderWorldCopies: false }),
    );
  });

  it('creates one marker per pin and fits bounds to all of them once the map loads', () => {
    const pins = [
      makePin({ id: 'a', lat: 30.65, lon: 113.15 }),
      makePin({ id: 'b', lat: 39.9, lon: 116.4 }),
    ];
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

  it('refreshes the rendered markers when the pins change while the dialog stays open', async () => {
    const { rerender } = render(
      <PlaceComparisonMap
        open
        pins={[makePin({ id: 'a' })]}
        title="Single place"
        onClose={jest.fn()}
      />,
    );
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    await act(async () => {
      rerender(
        <PlaceComparisonMap
          open
          pins={[makePin({ id: 'a' }), makePin({ id: 'b', lat: 39.9, lon: 116.4 })]}
          title="Two places"
          onClose={jest.fn()}
        />,
      );
      await Promise.resolve();
    });
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockSetLngLat).toHaveBeenCalledTimes(3);
    expect(mockAddTo).toHaveBeenCalledTimes(3);
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
  });

  it('jumps to the single pin instead of fitting bounds when there is only one', () => {
    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);

    onLoadCallback?.();

    expect(mockJumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: [113.15, 30.65] }));
    expect(mockFitBounds).not.toHaveBeenCalled();
  });

  it('renders the dialog title and closes via the close button', () => {
    const onClose = jest.fn();
    render(
      <PlaceComparisonMap
        open
        pins={[makePin()]}
        title="竟陵 — compare clusters"
        onClose={onClose}
      />,
    );

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

  it('swaps in the real vector basemap once a bundle covering the pins is confirmed installed', async () => {
    // makePin() defaults to 竟陵 (30.65, 113.15), which falls inside the "china" bundle's bounds.
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({
        installed: true,
        path: '/tiles',
        regions: [
          {
            id: 'china',
            sha256: 'a'.repeat(64),
            installedAt: '2026-07-26T00:00:00Z',
            // Regional extracts often top out below full Protomaps z15.
            maxZoom: 8,
          },
        ],
      }),
    };

    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    expect(mockSetMaxZoom).toHaveBeenCalledWith(8);
    expect(mockSetStyle).toHaveBeenCalledTimes(1);
    const [style] = mockSetStyle.mock.calls[0];
    expect(style.sources.protomaps.tiles[0]).toBe('pmtiles://china/{z}/{x}/{y}.mvt');
    expect(style.sources.protomaps.maxzoom).toBe(8);
    expect(mockSetMaxBounds).toHaveBeenCalledWith([
      [73.5, 15.8],
      [134.8, 53.6],
    ]);
  });

  it('leaves the blank background and shows the region warning when no bundle covering the pins is installed', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({ installed: false, path: null, regions: [] }),
    };

    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    expect(mockSetStyle).not.toHaveBeenCalled();
    expect(screen.getByText(/isn't downloaded/)).toBeTruthy();
  });

  it('does not show the region warning once the current view is covered by an installed bundle', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({
        installed: true,
        path: '/tiles',
        regions: [{ id: 'china', sha256: 'a'.repeat(64), installedAt: '2026-07-26T00:00:00Z' }],
      }),
    };

    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    expect(screen.queryByText(/isn't downloaded/)).toBeNull();
  });

  it('does not constrain camera bounds when no covering tile bundle is installed', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({ installed: false, path: null, regions: [] }),
    };

    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    expect(mockSetMaxBounds).not.toHaveBeenCalled();
  });

  it('warns without constraining when only a non-covering region is installed', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({
        installed: true,
        path: '/tiles',
        // Japan tiles only — 竟陵 (China) is not covered, so warning stays on
        // and maxBounds is not applied for this pin set.
        regions: [{ id: 'japan', sha256: 'a'.repeat(64), installedAt: '2026-07-26T00:00:00Z' }],
      }),
    };

    render(<PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />);
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });
    expect(screen.getByText(/isn't downloaded/)).toBeTruthy();
    expect(mockSetMaxBounds).not.toHaveBeenCalled();
  });
});
