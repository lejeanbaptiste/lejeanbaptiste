import { log } from '@src//utilities';
import type { IAnnotationUserProfile, User } from '@src/types';
import Cookies from 'js-cookie';
import { Context } from '../index';
import type { ILinkedAccount } from './effects';

//* INIITIALIZE
export const onInitializeOvermind = async ({ actions, effects }: Context, overmind: any) => {
  // Setup API
  await effects.auth.api.setup();

  //Get LINCS Providers
  const providers = await effects.auth.api.getProviders();

  //populate supported providers
  if (!('error' in providers)) actions.providers.setup(providers);

  //Authenticate
  await actions.auth.authenticateUser();
};

//* AUTHENTICATION

export const authenticateUser = async ({ state, actions, effects }: Context) => {
  state.auth.userState = 'AUTHENTICATING';
  const sessionAuthenticated = await effects.auth.api.init();

  if (!sessionAuthenticated) {
    state.auth.userState = 'UNAUTHENTICATED';
    return;
  }

  const token = await effects.auth.api.getToken();
  if (!token) return log.warn('No Authentication token');

  //Identity provider
  const identityProvider = await actions.auth.setupMainIdentityProvider(token);
  if (!identityProvider) return;

  await actions.auth.setUserProfile(identityProvider);

  state.auth.userState = sessionAuthenticated ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
};

export const getKeycloakAuthToken = async ({ effects }: Context) => {
  const token = await effects.auth.api.getToken();
  return token;
};

export const setupMainIdentityProvider = async ({ actions, effects }: Context, token: string) => {
  const identity_provider = effects.auth.api.getIdentityProvider();
  if (!identity_provider) return log.warn('No identity_provider');

  const IDPTokens = await effects.auth.api.getExternalIDPTokens(identity_provider, token);

  if (typeof IDPTokens !== 'string' && 'error' in IDPTokens) {
    const { message } = IDPTokens.error;
    actions.ui.emitNotification({ message });
    return;
  }

  if (!IDPTokens) return log.warn('No identity_provider tokens');

  const provider = await actions.providers.initProvider({
    IDPTokens,
    providerName: identity_provider,
  });

  if (!provider?.service) {
    log.warn(`Identity Provider ${identity_provider} is not supported`);
    return;
  }

  return identity_provider;
};

export const setUserProfile = async (
  { state, actions, effects }: Context,
  identityProvider: string
) => {
  const keyCloakProfile = await effects.auth.api.getUserData();
  const user = keyCloakProfile as User;
  state.auth.user = user;

  if (state.providers.identityProviders.length === 0) return;

  //augment user profile
  state.auth.user.identities = new Map();
  await actions.auth.getLinkedAccounts();

  //preferredID
  const preferredID = effects.storage.api.getFromLocalStorage<string>('prefIdProvider');
  //if not preferredID, use the first identityProviders linked Account
  preferredID
    ? (state.auth.user.preferredID = preferredID)
    : actions.auth.setPreferredId(identityProvider);

  //use avatar from preffed ID
  state.auth.user.avatar_url = user.identities.get(user.preferredID)?.avatar_url ?? undefined;
};

export const linkAccount = async ({ actions, effects }: Context, identity_provider: string) => {
  const token = await effects.auth.api.getToken();
  if (!token) return log.warn('No Authentication token');

  const linkAccountUrl = await effects.auth.api.getLinkAccountUrl(identity_provider, token);
  if (typeof linkAccountUrl !== 'string') {
    const { message } = linkAccountUrl.error;
    actions.ui.emitNotification({ message });
    return;
  }

  return linkAccountUrl;
};

export const getLinkedAccounts = async ({ state, actions, effects }: Context) => {
  if (!state.auth.user) return;

  const token = await effects.auth.api.getToken();
  if (!token) return log.warn('No Authentication token');

  const linkedAccounts = await effects.auth.api.getLinkedAccounts(token, state.auth.user.username);
  if ('error' in linkedAccounts) {
    const { message } = linkedAccounts.error;
    actions.ui.emitNotification({ message });
    return;
  }

  if (linkedAccounts.length === 0) return;

  for await (const account of linkedAccounts) {
    //IDENTITY
    const providerName = account.identityProvider;
    if (state.auth.user.identities.get(providerName)) continue;

    if (!actions.providers.isProviderInitilized(providerName)) {
      await actions.auth.setupLinkedAccountProvider(account);
    }

    const userDetails = await actions.auth.getUserDetails(account);
    if (!userDetails) continue;
    state.auth.user.identities.set(providerName, userDetails);
  }

  return linkedAccounts;
};

export const getUserDetails = async (
  { state }: Context,
  { identityProvider: providerName, userId }: ILinkedAccount
) => {
  const { supportedProviders } = state.providers;

  const provider = supportedProviders.find((p) => p.providerId === providerName && p.service);
  if (!provider?.service) return;

  const userDetails = await provider.service.getAuthenticatedUser(userId);
  if (!userDetails) return;

  if (state.auth.user) state.auth.user.identities.set(providerName, userDetails);
  return userDetails;
};

export const setupLinkedAccountProvider = async (
  { actions, effects }: Context,
  { identityProvider: providerName, userId, userName }: ILinkedAccount
) => {
  const token = await effects.auth.api.getToken();
  if (!token) return log.warn('No Authentication token');

  const IDPTokens = await effects.auth.api.getExternalIDPTokens(providerName, token);
  if (typeof IDPTokens !== 'string' && 'error' in IDPTokens) {
    const { message } = IDPTokens.error;
    actions.ui.emitNotification({ message });
    return;
  }

  if (!IDPTokens) return log.warn('No identity_provider tokens');

  const provider = await actions.providers.initProvider({
    IDPTokens,
    providerName,
    userId,
    userName,
  });

  if (!provider?.service) log.warn(`Identity Provider ${providerName} is not supported`);
};

export const getUserProfile = ({ state }: Context) => {
  const { user } = state.auth;
  if (!user || user.identities.size === 0) return;

  const preferredID = user.preferredID;

  const name = user.identities.get(preferredID)?.name;
  const url = user.identities.get(preferredID)?.uri;

  if (!name || !url) return;

  const username = user.identities.get(preferredID)?.username;
  const avatar_url = user.avatar_url;
  const email = user.email;

  const annotationUserProfile: IAnnotationUserProfile = {
    name,
    url,
    avatar_url,
    email,
    preferredID,
    username,
  };

  return annotationUserProfile;
};

//* USER

export const signIn = ({ effects }: Context, options?: { idpHint?: string }) => {
  effects.auth.api.login(options);
};

export const accountManagement = ({ effects }: Context) => {
  effects.auth.api.accountManagement();
};

export const signOut = async ({ effects }: Context) => {
  localStorage.clear();
  Cookies.remove('resource');
  await effects.auth.api.logout();
};

export const setPreferredId = ({ state, actions }: Context, providerId: string) => {
  if (!state.auth.user) return;
  state.auth.user.preferredID = providerId;
  localStorage.setItem('prefIdProvider', providerId);

  state.auth.user.avatar_url = state.auth.user.identities.get(providerId)?.avatar_url ?? undefined;

  //preferred storage
  actions.storage.changePrefStorageProvider(providerId);

  return providerId;
};
