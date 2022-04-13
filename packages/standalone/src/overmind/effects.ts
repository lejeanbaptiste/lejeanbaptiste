import axios, { AxiosError } from 'axios';
import { KEYCLOACK_BASE_URL, NSSI_BASE_URL } from '../config/config';

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
      .get(`${KEYCLOACK_BASE_URL}/auth/realms/${realm}/broker/${provider_alias}/token`, {
        headers: { Authorization: `Bearer ${keycloakAccessCode}` },
      })
      .catch((error: AxiosError) => {
        if (error.response) return error.response;

        const errorJson = error.toJSON();
        console.error(errorJson);

        throw new Error(error.message);
      });

    const { status, data } = response;
    if (status >= 400) {
      return { error: { status, message: `Linked Accounts Tokens: ${data.error}` } };
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
        console.error(errorJson);

        throw new Error(error.message);
      });

    const { status, data } = response;
    if (status >= 400) {
      return { error: { status, message: `Linked Accounts: ${data.error}` } };
    }

    return data;
  },

  linkAccount: async (identity_provider: string, keycloakAccessCode: string): Promise<any> => {
    const response = await axios
      .get(
        `${NSSI_BASE_URL}/userinfo/accountLinkUrl?provider=${identity_provider}&redirectUri=${LINK_ACCOUNTS_CALLBACK_URL}`,
        { headers: { Authorization: `Bearer ${keycloakAccessCode}` } }
      )
      .catch((error: AxiosError) => {
        if (error.response) return error.response;

        const errorJson = error.toJSON();
        console.error(errorJson);

        throw new Error(error.message);
      });

    const { status, data } = response;
    if (status >= 400) {
      return { error: { status, message: `Link Account: ${data.error}` } };
    }

    return data;
  },
};

export const localAPI = {
  async loadTemplate(url: string) {
    const response = await axios.get(url);
    return response.data;
  },
};
