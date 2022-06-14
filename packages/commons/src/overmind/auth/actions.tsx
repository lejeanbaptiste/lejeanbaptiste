import { log } from '@src//utilities/log';
import { setIndentityProvider } from '@src/services';
import AuthenticationService from '@src/services/AuthenticationService';
import type { IAnnotationUserProfile, User } from '@src/types';
import Cookies from 'js-cookie';
import { Context } from '../index';
import { ILinkedAccount } from './effects';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state, actions }: Context, overmind: any) => {
  //Authenticate
  await actions.auth.initiateUserProvider();
};

//* AUTHENTICATION

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getLincsAauthenticationToken = async ({ state }: Context) => {
  await AuthenticationService.updateToken();
  const token = AuthenticationService.getToken();
  return token;
};

export const initiateUserProvider = async ({ state, actions }: Context) => {
  state.auth.userState = 'AUTHENTICATING';
  const sessionAuthenticated = await AuthenticationService.init();

  if (!sessionAuthenticated) {
    return (state.auth.userState = 'UNAUTHENTICATED');
  }

  //Identity provider
  await actions.auth.setupMainIdentityProvider();
  await actions.auth.setUserProfile();
  await actions.storage.setupStorageProvider(); //based on identity providers

  //
  state.auth.userState = sessionAuthenticated ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
};

export const setupMainIdentityProvider = async ({ state, actions, effects }: Context) => {
  const token = await actions.auth.getLincsAauthenticationToken();
  if (!token) return log.warn('No Authentication token');

  const identity_provider = AuthenticationService.getIdentityProvider();
  if (!identity_provider) return log.warn('No identity_provider');

  const IDPTokens = await effects.auth.KeycloakApi.getExternalIDPTokens(
    'lincs',
    identity_provider,
    token
  );

  if (typeof IDPTokens !== 'string' && 'error' in IDPTokens) {
    const { message } = IDPTokens.error;
    actions.ui.emitNotification({ message });
    return;
  }

  if (!IDPTokens) return log.warn('No identity_provider tokens');

  const provider = setIndentityProvider({ IDPTokens, providerName: identity_provider });

  state.auth.identityProviders[identity_provider] = provider;
};

export const setUserProfile = async ({ state, actions }: Context) => {
  const keyCloakProfile = await AuthenticationService.getUserData();
  const user = keyCloakProfile as User;
  state.auth.user = user;

  if (!state.auth.identityProviders) return;

  //augment user profile
  state.auth.user.identities = new Map();
  await actions.auth.getLinkedAccounts();

  //prefferedID
  const prefferedID = localStorage.getItem('prefIdProvider');
  //if not prefferedID, use the first identityProviders linked Account
  prefferedID
    ? (state.auth.user.prefferedID = prefferedID)
    : actions.auth.changePrefferedID(Object.keys(state.auth.identityProviders)[0]);

  //use avatar from preffed ID
  state.auth.user.avatar_url = user.identities.get(user.prefferedID)?.avatar_url ?? undefined;
};

export const linkAccount = async ({ actions, effects }: Context, identity_provider: string) => {
  const token = await actions.auth.getLincsAauthenticationToken();
  if (!token) return log.warn('No Authentication token');

  const linkAccountUrl = await effects.auth.NSSIApi.getLinkAccountUrl(identity_provider, token);
  if (typeof linkAccountUrl !== 'string') {
    const { message } = linkAccountUrl.error;
    actions.ui.emitNotification({ message });
    return;
  }

  return linkAccountUrl;
};

export const getLinkedAccounts = async ({ state, actions, effects }: Context) => {
  if (!state.auth.user) return;
  const token = await actions.auth.getLincsAauthenticationToken();
  if (!token) return log.warn('No Authentication token');

  const linkedAccounts = await effects.auth.NSSIApi.getLinkedAccounts(token);
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

    const identityProvider = await actions.auth._linkIdentityProvider(account);

    //STORAGE
    if (identityProvider) actions.storage._linkStorageProvider(providerName);
  }

  return linkedAccounts;
};

export const _linkIdentityProvider = async (
  { state, actions, effects }: Context,
  { identityProvider: providerName, userId, userName }: ILinkedAccount
) => {
  if (!state.auth.user) return;

  const token = await actions.auth.getLincsAauthenticationToken();
  if (!token) return log.warn('No Authentication token');

  const IDPTokens = await effects.auth.KeycloakApi.getExternalIDPTokens(
    'lincs',
    providerName,
    token
  );
  if (typeof IDPTokens !== 'string' && 'error' in IDPTokens) {
    const { message } = IDPTokens.error;
    actions.ui.emitNotification({ message });
    return;
  }

  if (!IDPTokens) return log.warn('No identity_provider tokens');

  const provider = setIndentityProvider({ IDPTokens, providerName, userId, userName });

  const userDetails = await provider.getAuthenticatedUser(userId);
  if (!userDetails) return;

  state.auth.identityProviders[providerName] = provider;
  state.auth.user.identities.set(providerName, userDetails);

  return provider;
};

export const setSampleUser = ({ state }: Context) => {
  // state.auth.user = {
  //   email: 'sampleUser@sample.com',
  //   firstName: 'Sample',
  //   lastName: 'User',
  //   username: 'sampleUser',
  //   identities: {
  //     github: {
  //       id: 0,
  //       email: 'sampleUser@sample.com',
  //       name: 'Sample User',
  //       login: 'lucaju',
  //       username: 'sampleUser',
  //     },
  //   },
  //   prefferedID: 'github',
  //   prefStorageProvider: 'github',
  // };
  // state.auth.userAuthenticated = true;
};

export const getUserProfile = ({ state }: Context) => {
  const { user } = state.auth;
  if (!user || user.identities.size === 0) return;

  const prefferedID = user.prefferedID;

  const name = user.identities.get(prefferedID)?.name;
  const url = user.identities.get(prefferedID)?.uri;

  if (!name || !url) return;

  const username = user.identities.get(prefferedID)?.username;
  const avatar_url = user.avatar_url;
  const email = user.email;

  const annotationUserProfile: IAnnotationUserProfile = {
    name,
    url,
    avatar_url,
    email,
    prefferedID,
    username,
  };

  return annotationUserProfile;
};

//* USER

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const signIn = ({ state }: Context) => {
  AuthenticationService.doLogin();
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const signOut = async ({ state }: Context) => {
  localStorage.clear();
  Cookies.remove('resource');
  await AuthenticationService.doLogout();
};

export const changePrefferedID = ({ state }: Context, iDproviderName: string) => {
  if (!state.auth.user) return;
  state.auth.user.prefferedID = iDproviderName;
  localStorage.setItem('prefIdProvider', iDproviderName);

  state.auth.user.avatar_url =
    state.auth.user.identities.get(iDproviderName)?.avatar_url ?? undefined;

  return iDproviderName;
};

export const getIdentityProvider = ({ state }: Context, name: string) => {
  return state.auth.identityProviders[name];
};
