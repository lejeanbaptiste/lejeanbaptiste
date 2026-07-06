export const DOCKED_AUTO_TAGGING_MOUNT_ID = 'desktop-panel-auto-tagging';
export const DOCKED_DISAMBIGUATION_MOUNT_ID = 'desktop-panel-disambiguation';

/** Show or hide a docked review mount in the desktop flex shell. */
export function setDockedReviewMountOpen(
  mountId: string,
  open: boolean,
  widthPx?: number,
): void {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  if (open && widthPx != null) {
    mount.style.display = 'block';
    mount.style.width = `${widthPx}px`;
    mount.style.minWidth = '0';
    mount.style.maxWidth = `${widthPx}px`;
    mount.style.flex = `0 0 ${widthPx}px`;
    return;
  }

  mount.style.display = 'none';
  mount.style.width = '0';
  mount.style.minWidth = '0';
  mount.style.maxWidth = '0';
  mount.style.flex = '0 0 0px';
}

/** Let the outer flex row and jQuery layout settle after a docked panel opens/closes. */
export function scheduleDesktopEditorRelayout(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.writer?.layoutManager?.resizeAll?.();
        window.writer?.layoutManager?.resizeEditor?.();
      } catch {
        // layout may not be ready yet
      }
    });
  });
}
