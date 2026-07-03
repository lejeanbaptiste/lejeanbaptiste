/**
 * Debug instrumentation for the desktop right-panel lifecycle. Entries accumulate
 * on window.__lwPanelTrace so both sides of the DOM-migration handshake land in
 * one timeline.
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
