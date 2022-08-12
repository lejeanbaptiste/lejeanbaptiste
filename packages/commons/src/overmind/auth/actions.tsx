import { log } from '@src//utilities/log';
import type { IAnnotationUserProfile, User } from '@src/types';
import Cookies from 'js-cookie';
import {
  AuthenticateProp,
  IdentityProviderName,
  identityServices,
  supportedIdentityProviders,
} from '../../services';
import { Context } from '../index';
import { ILinkedAccount } from './effects';

//* INIITIALIZE
export const onInitializeOvermind = async ({ actions }: Context, overmind: any) => {
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
  await actions.auth.setupMainIdentityProvider(token);
  await actions.auth.setUserProfile();
  await actions.storage.setupStorageProvider(token); //based on identity providers

  //
  state.auth.userState = sessionAuthenticated ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
};

export const getKeycloskAuthenticationToken = async ({ effects }: Context) => {
  const token = await effects.auth.api.getToken();
  return token;
};

export const setIndentityProvider = async (
  { state }: Context,
  { IDPTokens, providerName, userId, userName }: AuthenticateProp
) => {
  if (!providerName || !supportedIdentityProviders.includes(providerName as IdentityProviderName)) {
    throw new Error('Identity Provider not supported');
  }

  const provider = identityServices.get(providerName as IdentityProviderName);
  if (!provider) throw new Error('Identity Provider not supported');

  provider.authenticate({ IDPTokens, userName, userId });

  return provider;
};

export const setupMainIdentityProvider = async (
  { state, actions, effects }: Context,
  token: string
) => {
  const identity_provider = effects.auth.api.getIdentityProvider();
  if (!identity_provider) return log.warn('No identity_provider');

  const IDPTokens = await effects.auth.api.getExternalIDPTokens(identity_provider, token);

  if (typeof IDPTokens !== 'string' && 'error' in IDPTokens) {
    const { message } = IDPTokens.error;
    actions.ui.emitNotification({ message });
    return;
  }

  if (!IDPTokens) return log.warn('No identity_provider tokens');

  const provider = await actions.auth.setIndentityProvider({
    IDPTokens,
    providerName: identity_provider,
  });

  state.auth.identityProviders.set(identity_provider as IdentityProviderName, provider);
};

export const setUserProfile = async ({ state, actions, effects }: Context) => {
  const keyCloakProfile = await effects.auth.api.getUserData();
  const user = keyCloakProfile as User;
  state.auth.user = user;

  if (!state.auth.identityProviders) return;

  //augment user profile
  state.auth.user.identities = new Map();
  await actions.auth.getLinkedAccounts();

  //preferredID
  const preferredID = localStorage.getItem('prefIdProvider');
  //if not preferredID, use the first identityProviders linked Account
  console.log({preferredID, user, idp: [...state.auth.identityProviders.keys()] })
  preferredID
    ? (state.auth.user.preferredID = preferredID)
    : actions.auth.changePreferredID([...state.auth.identityProviders.keys()][0]);

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

  const linkedAccounts = await effects.auth.api.getLinkedAccounts(token);
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
  const { auth, ui } = actions;

  const token = await effects.auth.api.getToken();
  if (!token) return log.warn('No Authentication token');

  const IDPTokens = await effects.auth.api.getExternalIDPTokens(providerName, token);
  if (typeof IDPTokens !== 'string' && 'error' in IDPTokens) {
    const { message } = IDPTokens.error;
    ui.emitNotification({ message });
    return;
  }

  if (!IDPTokens) return log.warn('No identity_provider tokens');

  const provider = await auth.setIndentityProvider({ IDPTokens, providerName, userId, userName });

  const userDetails = await provider.getAuthenticatedUser(userId);
  if (!userDetails) return;

  state.auth.identityProviders.set(providerName as IdentityProviderName, provider);
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
  //   preferredID: 'github',
  //   prefStorageProvider: 'github',
  // };
  // state.auth.userAuthenticated = true;
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

export const signIn = ({ effects }: Context) => {
  effects.auth.api.login();
};

export const accountManagement = ({ effects }: Context) => {
  effects.auth.api.accountManagement();
};

export const signOut = async ({ effects }: Context) => {
  localStorage.clear();
  Cookies.remove('resource');
  await effects.auth.api.logout();
};

export const changePreferredID = ({ state }: Context, iDproviderName: string) => {
  if (!state.auth.user) return;
  state.auth.user.preferredID = iDproviderName;
  localStorage.setItem('prefIdProvider', iDproviderName);

  state.auth.user.avatar_url =
    state.auth.user.identities.get(iDproviderName)?.avatar_url ?? undefined;

  return iDproviderName;
};

export const getIdentityProvider = ({ state }: Context, name: IdentityProviderName) => {
  return state.auth.identityProviders.get(name);
};
