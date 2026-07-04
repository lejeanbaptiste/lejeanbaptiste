/** Join path segments using the separator the root already uses. */
export function joinPath(root: string, ...segments: string[]): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  const base = root.replace(/[/\\]+$/, '');
  return [base, ...segments].join(sep);
}
