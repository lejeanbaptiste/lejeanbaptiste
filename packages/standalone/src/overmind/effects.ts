import axios from 'axios';

const LINK_ACCOUNTS_CALLBACK_URL = 'https://localhost/link-accounts';
const LINCS_KEYCLOACK_BASE_URL = 'https://keycloak.dev.lincsproject.ca';
// const LINCS_SANDBOX_BASE_URL =
//   'https://api.16893933-review-nerve-inte-fh4wjn.sandbox.lincsproject.ca';

const LINCS_SANDBOX_BASE_URL = 'https://api.nssi.dev.lincsproject.ca/api';

// const LINCS_SANDBOX_BASE_URL =
// `https://api.16893933-review-dev-4jxwt5.dev.lincsproject.ca/api`;

export const LincsApi = {
  getExternalIDPTokens: async (
    realm: string,
    provider_alias: string,
    keycloakAccessCode: string
  ): Promise<any> => {
    const response = await axios.get(
      `${LINCS_KEYCLOACK_BASE_URL}/auth/realms/${realm}/broker/${provider_alias}/token`,
      {
        headers: { Authorization: `Bearer ${keycloakAccessCode}` },
      }
    );

    return response.data;
  },

  getLinkedAccounts: async (keycloakAccessCode: string): Promise<any> => {
    const response = await axios.get(`${LINCS_SANDBOX_BASE_URL}/userinfo/linkedAccounts`, {
      headers: { Authorization: `Bearer ${keycloakAccessCode}` },
    });

    return response.data;
  },

  linkAccount: async (identity_provider: string, keycloakAccessCode: string): Promise<any> => {
    const response = await axios.get(
      `${LINCS_SANDBOX_BASE_URL}/userinfo/accountLinkUrl?provider=${identity_provider}&redirectUri=${LINK_ACCOUNTS_CALLBACK_URL}`,
      {
        headers: { Authorization: `Bearer ${keycloakAccessCode}` },
      }
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
