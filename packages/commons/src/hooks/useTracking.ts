import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { log } from '../utilities/log';

declare global {
  interface Window {
    gtag?: (key: string, trackingId: string, config: { page_path: string }) => void;
  }
}

export const useTracking = (trackingId?: string) => {
  const location = useLocation();

  useEffect(() => {
    const unlisten = () => {
      if (!window.gtag) return;
      if (!trackingId) {
        log.warn(
          'Tracking not enabled, as `trackingId` was not given and there is no `GA_MEASUREMENT_ID`.'
        );
        return;
      }

      window.gtag('config', trackingId, { page_path: location.pathname });
    };

    return unlisten;
  }, [trackingId, location.pathname]);
};
