import googleAnalytics from '@analytics/google-analytics';
import Analytics, { AnalyticsInstance } from 'analytics';
import pck from '../package.json';

export let analytics: AnalyticsInstance;

export const initAnalytics = async (getGAID: () => Promise<string>) => {
  const GAID = await getGAID();

  analytics = Analytics({
    app: 'LEAF-Writer',
    version: pck.version,
    plugins: [
      googleAnalytics({
        measurementIds: [GAID],
      }),
    ],
  });

  return analytics;
};
