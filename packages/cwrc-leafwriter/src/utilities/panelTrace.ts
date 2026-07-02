/**
 * Debug instrumentation for the desktop right-panel lifecycle (imageViewer / validation
 * blank-panel investigation). Entries accumulate on window.__lwPanelTrace and mirror to
 * the console as '[PanelTrace]' lines. Inspect with `window.__lwPanelTrace` in devtools.
 */
declare global {
  interface Window {
    __lwPanelTrace?: { t: string; tag: string; data?: Record<string, unknown> }[];
  }
}

export const panelTrace = (tag: string, data?: Record<string, unknown>) => {
  const entry = {
    t: new Date().toISOString().slice(11, 23),
    tag,
    ...(data ? { data } : {}),
  };
  (window.__lwPanelTrace ??= []).push(entry);
  console.debug('[PanelTrace]', entry.t, tag, data ?? '');
};

/** Snapshot of a panel container node: existence, visibility, and content. */
export const describePanelNode = (node: HTMLElement | null) => {
  if (!node) return { exists: false };
  return {
    exists: true,
    connected: node.isConnected,
    childCount: node.childElementCount,
    inlineStyle: node.getAttribute('style'),
    display: window.getComputedStyle(node).display,
    width: node.offsetWidth,
    height: node.offsetHeight,
    parentId: node.parentElement?.id || node.parentElement?.className || null,
  };
};
