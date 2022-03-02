import axios from 'axios';

const LINK_ACCOUNTS_CALLBACK_URL = `${window.location.origin}/link-accounts`;

const KEYCLOACK_DEV_URL = 'https://keycloak.dev.lincsproject.ca';
// const NSSI_REVIEW_URL = 'https://api.16893933-review-243-workfl-r3lefc.dev.lincsproject.ca/api/';
const NSSI_STAGE_URL = 'https://api.nssi.stage.lincsproject.ca/api/';

export const LincsApi = {
  getExternalIDPTokens: async (
    realm: string,
    provider_alias: string,
    keycloakAccessCode: string
  ): Promise<any> => {
    const response = await axios.get(
      `${KEYCLOACK_DEV_URL}/auth/realms/${realm}/broker/${provider_alias}/token`,
      { headers: { Authorization: `Bearer ${keycloakAccessCode}` } }
    );

    return response.data;
  },

  getLinkedAccounts: async (keycloakAccessCode: string): Promise<any> => {
    const response = await axios.get(`${NSSI_STAGE_URL}/userinfo/linkedAccounts`, {
      headers: { Authorization: `Bearer ${keycloakAccessCode}` },
    });

    return response.data;
  },

  linkAccount: async (identity_provider: string, keycloakAccessCode: string): Promise<any> => {
    const response = await axios.get(
      `${NSSI_STAGE_URL}/userinfo/accountLinkUrl?provider=${identity_provider}&redirectUri=${LINK_ACCOUNTS_CALLBACK_URL}`,
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
