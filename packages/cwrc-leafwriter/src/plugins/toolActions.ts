export type PluginToolActionHandler = (ctx: {
  notify: (message: string) => void;
}) => void | Promise<void>;

const handlers = new Map<string, PluginToolActionHandler>();

export function registerPluginToolAction(action: string, handler: PluginToolActionHandler) {
  handlers.set(action, handler);
}

export function isKnownPluginToolAction(action: string): boolean {
  return handlers.has(action);
}

export async function dispatchPluginToolAction(
  action: string,
  ctx: { notify: (message: string) => void },
): Promise<boolean> {
  const handler = handlers.get(action);
  if (!handler) return false;
  await handler(ctx);
  return true;
}
