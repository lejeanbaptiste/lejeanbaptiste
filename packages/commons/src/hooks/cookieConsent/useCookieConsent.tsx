import { Typography } from '@mui/material';
import { TextEmphasis } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useAnalytics } from '..';

import 'vanilla-cookieconsent';
import './cookieConsent.css';

let cookieConsent: CookieConsent;

export const useCookieConsent = () => {
  const { userState } = useAppState().auth;
  const { signOut } = useActions().auth;
  const { setCookieConsent, openDialog } = useActions().ui;

  const { t } = useTranslation('cookieConsent');

  const { stopAnalytics } = useAnalytics();

  const handleClickPrivacyPolicy = () => {
    cookieConsent.hideSettings();
    openDialog({ type: 'privacy' });
  };

  useEffect(() => {
    if (!cookieConsent) {
      cookieConsent = window.initCookieConsent();
      initialize();
    }

    const linkPrivacyPolicy = document.getElementById('linkToPrivacyPolicy');
    if (linkPrivacyPolicy) linkPrivacyPolicy.onclick = handleClickPrivacyPolicy;
  }, []);

  const beforeRemoveBasicConsent = (cookie: any) => {
    if (auth.userState == 'AUTHENTICATED') {
      openDialog({
        props: {
          severity: 'warning',
          title: t('privacy_settings'),
          Message: () => (
            <>
              <Typography paragraph>
                <Trans i18nKey="cookie_consent:warning.remove_consent_basic_interactions_message">
                  <Typography component="span">Removing consent for </Typography>
                  <TextEmphasis color="warning">
                    {`Basic interactions & functionalities`}
                  </TextEmphasis>
                  <Typography component="span">will sign you out.</Typography>
                </Trans>
              </Typography>
              {ui.page === 'edit' && editor.isDirty && (
                <Typography>{t('storage:you_will_lose_any_unsaved_changes')}.</Typography>
              )}
            </>
          ),
          actions: [
            { action: 'cancel', label: t('commons:cancel'), variant: 'outlined' },
            {
              action: 'signout',
              label: `${t('remove_consent')} ${t('commons:and')} ${t('commons:sign_out')}`,
            },
          ],
          //@ts-ignore
          onClose: async (action: string) => {
            if (action === 'cancel') {
              //restablish categories
              cookieConsent.accept([...cookie.categories, 'interaction']);
              return;
            }

            clearCookieConsent();
            signOut();
          },
        },
      });
    }
  };

  const initialize = () => {
    cookieConsent.run({
      current_lang: 'en-CA',
      autoclear_cookies: true, // default: false
      // force_consent: false,                   // default: false
      // cookie_expiration: 182,                 // default: 182 (days)
      // cookie_necessary_only_expiration: 182   // default: disabled
      // revision: 0,                            // default: 0

      onFirstAction: (user_preferences, cookie) => {
        setCookieConsent(cookie.categories);
      },

      onAccept: (cookie) => {
        setCookieConsent(cookie.categories);
      },

      onChange: (cookie, _changed_preferences) => {
        setCookieConsent(cookie.categories);

        if (!cookie.categories.includes('measurement')) stopAnalytics();

        if (!cookie.categories.includes('interaction')) {
          beforeRemoveBasicConsent(cookie);
        }
      },

      gui_options: {
        consent_modal: {
          layout: 'bar',
          transition: 'slide',
        },
        settings_modal: {
          layout: 'bar',
          transition: 'slide',
        },
      },

      languages: {
        'en-CA': {
          //@ts-ignore
          consent_modal: consentModalContent('en-CA'),
          //@ts-ignore
          settings_modal: consentSettingsContent('en-CA'),
        },
        'fr-CA': {
          //@ts-ignore
          consent_modal: consentModalContent('fr-CA'),
          //@ts-ignore
          settings_modal: consentSettingsContent('fr-CA'),
        },
      },
    });

    return cookieConsent;
  };

  const consentModalContent = (lng: string) => {
    const pStyle = 'margin-bottom: 8px';
    return {
      title: `${t('consentBanner.we use cookies', { lng })}!`,
      description: `
    <p style="${pStyle}">${t('consentBanner.line1', { lng })}</p>
    <p style="${pStyle}">${t('consentBanner.line2', { lng })}</p>
    <p style="${pStyle}">${t('consentBanner.line3', { lng })}</p>
    <button type="button" data-cc="c-settings" class="cc-link" style="text-transform: capitalize">${t(
      'consentBanner.let me choose'
    )}</button>`,
      primary_btn: {
        text: t('commons:acceptAll', { lng }),
        role: 'accept_all', // 'accept_selected' or 'accept_all'
      },
      secondary_btn: {
        text: t('commons:rejectAll', { lng }),
        role: 'accept_necessary', // 'settings' or 'accept_necessary'
      },
    };
  };

  const consentSettingsContent = (lng: string) => ({
    title: t('settingsModal.consent preferences', { lng }),
    save_settings_btn: t('commons:saveSettings', { lng }),
    accept_all_btn: t('commons:acceptAll', { lng }),
    reject_all_btn: t('commons:rejectAll', { lng }),
    close_btn_label: t('commons:close', { lng }),
    cookie_table_headers: [
      { col1: t('commons:name', { lng }) },
      { col2: t('settingsModal.domain', { lng }) },
      { col3: t('settingsModal.expiration', { lng }) },
      { col4: t('commons:description', { lng }) },
    ],
    blocks: [
      {
        title: `${t('settingsModal.cookie usage', { lng })}  📢`,
        description: `<p> ${t('settingsModal.cookie usage description', {
          lng,
        })} <span id="linkToPrivacyPolicy" class="cc-link">${t('commons:privacyPolicy', {
          lng,
        })}</span>.</p>`,
      },
      {
        title: t('settingsModal.strictly necessary', { lng }),
        //e.g., Backup saving and management, Hosting and backend infrastructure, Managing landing and invitation pages, Platform services and hosting, SPAM protection, Traffic optimization and distribution, Infrastructure monitoring, Handling payments
        description: t('settingsModal.strictly necessary description', { lng }),
        toggle: {
          value: 'necessary',
          enabled: true,
          readonly: true, // cookie categories with readonly=true are all treated as "necessary cookies"
        },
        cookie_table: [
          // list of all expected cookies
          {
            col1: 'cc_cookie',
            col2: location.hostname,
            col3: t('settingsModal.cookie_expiration_time', {
              lng,
              value: 6,
              period: 'months',
            }),
            col4: t('settingsModal.cc_cookie description', { lng }),
          },
        ],
      },
      {
        title: t('settingsModal.basic interactions and functionalities', { lng }),
        //e.g., Contacting the User, Interaction with live chat platforms Managing web conferencing and online telephony, Managing support and contact requests, Interaction with support and feedback platforms, Tag Management, Registration and authentication, User database management
        description: t('settingsModal.basic interactions and functionalities description', { lng }),
        toggle: {
          value: 'interaction',
          enabled: true,
          readonly: false,
        },
        cookie_table: [
          // list of all expected cookies
          {
            col1: 'AUTH_SESSION_',
            col2: 'lincsproject.ca',
            col3: t('commons:session', { lng }),
            col4: t('settingsModal.AUTH_SESSION_description', { lng }),
            is_regex: true,
          },
          {
            col1: 'lw_',
            col2: location.hostname,
            col3: t('settingsModal.indefinitely until user sign out', { lng }),
            col4: t('settingsModal.lw_ description', { lng }),
            is_regex: true,
          },
        ],
      },
      {
        title: t('settingsModal.measurement', { lng }),
        // e.g., Analytics, Beta testing, Content performance and feature testing (A/B testing), Heat mapping and session recording, Managing data collection and online surveys
        description: t('settingsModal.measurement description', { lng }),
        toggle: {
          value: 'measurement',
          enabled: false,
          readonly: false,
        },
        cookie_table: [
          {
            col1: '_ga_#', // match all cookies starting with "_ga"
            col2: 'google.com',
            col3: t('settingsModal.cookie_expiration_time', {
              lng,
              value: 1,
              period: 'year',
            }),
            col4: t('settingsModal._ga_ description', { lng }),
            is_regex: true,
          },
        ],
      },
      {
        title: t('commons:moreInformation', { lng }),
        description: `<p> ${t('settingsModal.more information description', {
          lng,
        })},  <a href="mailto:cwrc-leaf@ualberta.ca" class="cc-link">${t('commons:contactUs', {
          lng,
        })}</a>.</p>`,
      },
    ],
  });

  const clearCookieConsent = () => {
    stopAnalytics();
    cookieConsent.eraseCookies(['cc_cookie']);
    setCookieConsent();
  };

  const eraseCookies = (cookies: string[]) => {
    cookieConsent.eraseCookies(cookies);
  };

  const showSettings = () => {
    cookieConsent.showSettings(0);
  };

  const switchLanguage = (language: string) => {
    cookieConsent.updateLanguage(language, true);
  };

  return {
    clearCookieConsent,
    cookieConsent,
    eraseCookies,
    showSettings,
    switchLanguage,
  };
};
