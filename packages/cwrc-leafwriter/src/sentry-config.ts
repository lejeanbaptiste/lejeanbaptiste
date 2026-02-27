import * as Sentry from '@sentry/react';

const sentryConfig: Sentry.BrowserOptions = {
  // ! DSN REQUIRED
  // dsn: '',
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  // session replay only set if LW config enableReplay is true to avoid conflicts with other apps
  // integrations: [Sentry.replayIntegration()],
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Capture Replay for 5% of all sessions,
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
};

export const getSentryConfig = (settings: {
  dsn: string;
  enableReplay?: boolean;
  tags?: { [key: string]: string };
}) => {
  sentryConfig.dsn = settings.dsn;
  if (settings.enableReplay) sentryConfig.integrations = [Sentry.replayIntegration()];
  if (settings.tags) sentryConfig.initialScope = { tags: settings.tags };
  return sentryConfig;
};
