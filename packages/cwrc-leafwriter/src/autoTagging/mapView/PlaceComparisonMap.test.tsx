import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      constructor(private options: { element: HTMLElement }) {}
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
        // Real MapLibre appends the marker element to the DOM; the click
        // listener the component attaches lives on that element, so tests
        // that click a pin (by data-testid) need it actually mounted.
        document.body.appendChild(this.options.element);
        return this;
      }
      remove() {
        mockMarkerRemove();
        this.options.element.remove();
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
  // NOT `{ virtual: true }`. jest.config.ts maps `^maplibre-gl$` to
  // test/mocks/maplibreGl.ts (the real package is ESM-only and jest's CJS
  // resolver cannot reach it). A virtual mock is keyed by the raw request
  // string and skips that resolution, so the component's mapped import could
  // bind to the silent stub instead of this factory - and which one it got
  // varied with module-registry state, so it only went wrong inside a large
  // run. The stub constructs fine and records nothing, so the symptom was
  // every assertion here seeing an untouched spy, with no error anywhere.
  // Without `virtual`, this factory mocks the mapped module and always wins.
);

function makePin(overrides: Partial<MapPin> = {}): MapPin {
  return {
    id: 'cbdb:a',
    label: 'A',
    color: '#d32f2f',
    lat: 30.65,
    lon: 113.15,
    sources: ['CBDB', 'CHGIS'],
    memberIds: ['cbdb:a'],
    ...overrides,
  };
}

/**
 * Render and wait until the map actually exists.
 *
 * The component's container div lives inside a MUI `Dialog`, whose portal
 * content mounts in a commit *after* the initial render, so the callback ref
 * that sets `container` runs a commit late.
 *
 * Two separate things made this suite fail as a unit, roughly half the runs,
 * but only as part of the full Core project — never on its own, and not under
 * CPU starvation either:
 *
 *  1. The map was built in a passive effect, which was sometimes never run at
 *     all: the dialog and its container div committed, and the MapLibre
 *     constructor was called zero times. No amount of waiting fixes that,
 *     because nothing was pending. It's now a *layout* effect (see
 *     PlaceComparisonMap.tsx), flushed as part of the commit that attaches the
 *     node.
 *  2. `render()` can still return before that commit has happened, so the
 *     assertion has to poll rather than run once. Under the full run, React's
 *     scheduler slices work by wall clock, so the number of flushes a mount
 *     takes is genuinely not fixed — it is not a stable microtask count the
 *     test can hard-code.
 *
 * The same reasoning applies to anything the effect's tile-status promise
 * chain produces: wait for it, don't assume a tick count.
 */
const renderMap = async (ui: Parameters<typeof render>[0]) => {
  const result = render(ui);
  await waitFor(() => expect(mockMapOptions).not.toBeNull());
  return result;
};

describe('PlaceComparisonMap', () => {
  afterEach(() => {
    jest.clearAllMocks();
    onLoadCallback = null;
    mockCenter = { lat: 30.65, lng: 113.15 };
    mockMapOptions = null;
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  it('limits map zoom to the maximum zoom supported by the tile source', async () => {
    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );

    expect(mockMapOptions).toEqual(
      expect.objectContaining({ maxZoom: 15, renderWorldCopies: false }),
    );
  });

  it('creates one marker per pin and fits bounds to all of them once the map loads', async () => {
    const pins = [
      makePin({ id: 'a', lat: 30.65, lon: 113.15 }),
      makePin({ id: 'b', lat: 39.9, lon: 116.4 }),
    ];
    await renderMap(
      <PlaceComparisonMap open pins={pins} title="竟陵 — compare clusters" onClose={jest.fn()} />,
    );

    onLoadCallback?.();

    expect(mockSetLngLat).toHaveBeenCalledTimes(2);
    expect(mockAddTo).toHaveBeenCalledTimes(2);
    expect(mockExtend).toHaveBeenCalledTimes(2);
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
    expect(mockJumpTo).not.toHaveBeenCalled();
  });

  it('calls onPinClick with the clicked pin', async () => {
    const onPinClick = jest.fn();
    const pin = makePin({ id: 'a', memberIds: ['a', 'a-viaf'] });
    await renderMap(
      <PlaceComparisonMap
        open
        pins={[pin]}
        title="Single place"
        onClose={jest.fn()}
        onPinClick={onPinClick}
      />,
    );
    onLoadCallback?.();

    fireEvent.click(screen.getByTestId('map-pin-a'));

    expect(onPinClick).toHaveBeenCalledTimes(1);
    expect(onPinClick).toHaveBeenCalledWith(pin);
  });

  it('does not error on a pin click when onPinClick is not provided', async () => {
    await renderMap(
      <PlaceComparisonMap
        open
        pins={[makePin({ id: 'a' })]}
        title="Single place"
        onClose={jest.fn()}
      />,
    );
    onLoadCallback?.();

    expect(() => fireEvent.click(screen.getByTestId('map-pin-a'))).not.toThrow();
  });

  it('refreshes the rendered markers when the pins change while the dialog stays open', async () => {
    const { rerender } = await renderMap(
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

  it('jumps to the single pin instead of fitting bounds when there is only one', async () => {
    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );

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

  it('tears down the map and its markers on unmount', async () => {
    const { unmount } = await renderMap(
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

    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    // Everything below is produced by the tile-status promise chain the effect
    // starts, not by the (synchronous) map construction - so it has to be
    // waited for. How many microtask ticks it takes to settle is not something
    // the test can assume: React's scheduler slices work by wall clock, so the
    // same file in the same order settles in a different number of flushes on
    // a loaded run than on an idle one. See renderMap's note.
    await waitFor(() => expect(mockSetStyle).toHaveBeenCalledTimes(1));
    expect(mockSetMaxZoom).toHaveBeenCalledWith(8);
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

    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    // Wait for the warning (the chain's positive outcome) before asserting the
    // negative: `not.toHaveBeenCalled()` would pass vacuously if the chain
    // simply hadn't run yet, testing nothing.
    expect(await screen.findByText(/isn't downloaded/)).toBeTruthy();
    expect(mockSetStyle).not.toHaveBeenCalled();
  });

  it('does not show the region warning once the current view is covered by an installed bundle', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({
        installed: true,
        path: '/tiles',
        regions: [{ id: 'china', sha256: 'a'.repeat(64), installedAt: '2026-07-26T00:00:00Z' }],
      }),
    };

    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    // The style swap and the warning decision happen in the same branch of the
    // chain, so waiting for the swap proves the chain ran - without it, a
    // still-pending chain would make this pass for the wrong reason.
    await waitFor(() => expect(mockSetStyle).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/isn't downloaded/)).toBeNull();
  });

  it('does not constrain camera bounds when no covering tile bundle is installed', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      mapTilesStatus: jest.fn().mockResolvedValue({ installed: false, path: null, regions: [] }),
    };

    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });

    expect(await screen.findByText(/isn't downloaded/)).toBeTruthy();
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

    await renderMap(
      <PlaceComparisonMap open pins={[makePin()]} title="Single place" onClose={jest.fn()} />,
    );
    await act(async () => {
      onLoadCallback?.();
      await Promise.resolve();
    });
    expect(await screen.findByText(/isn't downloaded/)).toBeTruthy();
    expect(mockSetMaxBounds).not.toHaveBeenCalled();
  });
});
