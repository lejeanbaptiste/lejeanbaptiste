import axios from 'axios';
import { KEYCLOACK_BASE_URL, NSSI_BASE_URL } from '../config/config';

const LINK_ACCOUNTS_CALLBACK_URL = `${window.location.origin}/link-accounts`;

export const LincsApi = {
  getExternalIDPTokens: async (
    realm: string,
    provider_alias: string,
    keycloakAccessCode: string
  ): Promise<any> => {
    const response = await axios.get(
      `${KEYCLOACK_BASE_URL}/auth/realms/${realm}/broker/${provider_alias}/token`,
      { headers: { Authorization: `Bearer ${keycloakAccessCode}` } }
    );

    return response.data;
  },

  getLinkedAccounts: async (keycloakAccessCode: string): Promise<any> => {
    const response = await axios.get(`${NSSI_BASE_URL}/userinfo/linkedAccounts`, {
      headers: { Authorization: `Bearer ${keycloakAccessCode}` },
    });

    return response.data;
  },

  linkAccount: async (identity_provider: string, keycloakAccessCode: string): Promise<any> => {
    const response = await axios.get(
      `${NSSI_BASE_URL}/userinfo/accountLinkUrl?provider=${identity_provider}&redirectUri=${LINK_ACCOUNTS_CALLBACK_URL}`,
      { headers: { Authorization: `Bearer ${keycloakAccessCode}` } }
    );

    return response.data;
  },
};

export const localAPI = {
  async loadTemplate(url: string) {
    const response = await axios.get(url);
    return response.data;
  },
};
