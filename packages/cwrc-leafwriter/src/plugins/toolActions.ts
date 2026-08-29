export type PluginToolActionHandler = (ctx: {
  notify: (message: string) => void;
}) => void | Promise<void>;

const handlers = new Map<string, PluginToolActionHandler>();
const actionOwners = new Map<string, string>();

export function registerPluginToolAction(
  action: string,
  handler: PluginToolActionHandler,
  pluginId?: string,
) {
  handlers.set(action, handler);
  if (pluginId) actionOwners.set(action, pluginId);
}

export function clearPluginToolActionsForPlugin(pluginId: string): void {
  for (const [action, owner] of actionOwners.entries()) {
    if (owner !== pluginId) continue;
    handlers.delete(action);
    actionOwners.delete(action);
  }
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
