import Keycloak, { KeycloakTokenParsed } from 'keycloak-js';

//Documentation: https://github.com/keycloak/keycloak-documentation/blob/master/securing_apps/topics/oidc/javascript-adapter.adoc

interface tokenParsed extends KeycloakTokenParsed {
  identity_provider?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  preferred_username?: string;
}

// Instantiate keycloak with nssi config file
const keycloak = Keycloak('/config/nssi-keycloak.json');

const init = async () => {
  const sessionAuthenticated = await keycloak
    .init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      pkceMethod: 'S256',
    })
    .catch(() => {
      console.warn('failed to contact keycloak');
    });

  return sessionAuthenticated;
};

const doLogin = async () => {
  return await keycloak.login({ redirectUri: window.location.origin });
};

const doLogout = keycloak.logout;

const getToken = () => keycloak.token;

const isLoggedIn = () => !!keycloak.token;

const isTokenExpired = () => keycloak.isTokenExpired();

const updateToken = async () => {
  return await keycloak.updateToken(5).catch(() => {
    alert('Failed to refresh the token, or the session has expired');
    keycloak.clearToken();
  });
};

const getIdentityProvider = () => {
  const tokenParsed = keycloak.tokenParsed as tokenParsed;
  if (!tokenParsed) return;
  return tokenParsed.identity_provider ?? undefined;
};

const getUserData = async () => {
  const tokenParsed = keycloak.tokenParsed as tokenParsed;
  if (!tokenParsed) return;

  const userProfile = await keycloak.loadUserProfile();
  return userProfile;
};

const hasRole = (roles: string[]) => roles.some((role) => keycloak.hasRealmRole(role));

const hasResourceRole = (role: string, resource?: string) => {
  return keycloak.hasResourceRole(role, resource);
};

const AuthenticationService = {
  init,
  doLogin,
  doLogout,
  isLoggedIn,
  isTokenExpired,
  getToken,
  getUserData,
  updateToken,
  getIdentityProvider,
  hasRole,
  hasResourceRole,
};

export default AuthenticationService;
