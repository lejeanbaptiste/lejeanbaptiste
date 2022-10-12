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
        googleAnalytics({
          measurementIds: [GAID],
          gtagConfig: {
            anonymize_ip: true,
          },
        }),
      ],
    });

    analytics.page();

    return analytics;
  };

  const stopAnalytics = () => {
    analytics?.reset();
    removeCookie('_ga');
    removeCookie('_ga_JG3NWYH6TY');
    analytics = null;
  };

  return {
    analytics,
    initAnalytics,
    stopAnalytics,
  };
};
