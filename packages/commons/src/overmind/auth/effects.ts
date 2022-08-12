import { KEYCLOACK_BASE_URL, NSSI_BASE_URL } from '@src/config';
import { log } from '@src/utilities/log';
import axios, { AxiosError } from 'axios';
import queryString from 'query-string';

const LINK_ACCOUNTS_CALLBACK_URL = `${window.location.origin}/link-accounts`;

export interface ILinkedAccount {
  identityProvider: string;
  userId?: string;
  userName?: string;
}

export interface IHTTPRequestError {
  error: {
    status?: number;
    message: string;
  };
}

export const KeycloakApi = {
  getExternalIDPTokens: async (
    realm: string,
    provider_alias: string,
    keycloakAccessCode: string
  ): Promise<any> => {
    const response = await axios
      .get(`${KEYCLOACK_BASE_URL}/realms/${realm}/broker/${provider_alias}/token`, {
        headers: { Authorization: `Bearer ${keycloakAccessCode}` },
      })
      .catch((error: AxiosError) => {
        if (error.response) return error.response;

        const errorJson = error.toJSON();
        log.error(errorJson);

        throw new Error(error.message);
      });

    const { status, data } = response;
    if (status >= 400) {
      return { error: { status, message: `getExternalIDPTokens: ${data.error}` } };
    }

    return data;
  },
};

export const NSSIApi = {
  getLinkedAccounts: async (
    keycloakAccessCode: string
  ): Promise<ILinkedAccount[] | IHTTPRequestError> => {
    const response = await axios
      .get(`${NSSI_BASE_URL}/userinfo/linkedAccounts`, {
        headers: { Authorization: `Bearer ${keycloakAccessCode}` },
      })
      .catch((error: AxiosError) => {
        if (error.response) return error.response;

        const errorJson = error.toJSON();
        log.error(errorJson);

        throw new Error(error.message);
      });

    const { status, data } = response;
    if (status >= 400) {
      return { error: { status, message: `Linked Accounts: ${data.error}` } };
    }

    return data;
  },

  getLinkAccountUrl: async (
    identity_provider: string,
    keycloakAccessCode: string
  ): Promise<string | IHTTPRequestError> => {
    const url = queryString.stringifyUrl({
      url: `${NSSI_BASE_URL}/userinfo/accountLinkUrl`,
      query: {
        provider: identity_provider,
        redirectUri: LINK_ACCOUNTS_CALLBACK_URL,
      },
    });

    const response = await axios
      .get(url, { headers: { Authorization: `Bearer ${keycloakAccessCode}` } })
      .catch((error: AxiosError) => {
        if (error.response) return error.response;

        const errorJson = error.toJSON();
        log.error(errorJson);

        throw new Error(error.message);
      });

    const { status, data } = response;
    if (status >= 400) {
      return { error: { status, message: `Link Account URL: ${data.error}` } };
    }

    return data;
//@ts-ignore
export const api = new Api('leaf-writer', process.env.KEYCLOAK_URL || '', process.env.NSSI_URL);
