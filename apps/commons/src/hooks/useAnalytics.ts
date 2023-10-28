/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-ignore
import { removeCookie } from '@analytics/cookie-utils';
//@ts-ignore
import googleAnalytics from '@analytics/google-analytics';
import Analytics, { type AnalyticsInstance } from 'analytics';
import pck from '../../package.json';
import { useActions } from '../overmind';

let analytics: AnalyticsInstance | null;

export const useAnalytics = () => {
  const { getGAID } = useActions().ui;

  const initAnalytics = async () => {
    if (analytics) return analytics;

    const GAID = await getGAID();

    analytics = Analytics({
      app: 'LEAF-Writer',
      version: pck.version,
      plugins: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        googleAnalytics({
          measurementIds: [GAID],
          gtagConfig: {
            anonymize_ip: true,
          },
        }),
      ],
    });

    void analytics.page();

    return analytics;
  };

  const stopAnalytics = () => {
    void analytics?.reset();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    void removeCookie('_ga');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    void removeCookie('_ga_JG3NWYH6TY');
    analytics = null;
  };

  return {
    analytics,
    initAnalytics,
    stopAnalytics,
  };
};
