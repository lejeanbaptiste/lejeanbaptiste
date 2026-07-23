export type AppUpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'current' }
  | { status: 'updateAvailable'; version: string }
  | { status: 'error'; message: string };
