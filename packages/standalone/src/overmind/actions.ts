import type {
  MessageDialog,
  IProviderAuth,
  PaletteMode,
  Resource,
  StorageDialogState,
  User,
  StorageProvider,
} from '@src/@types/types';
import { setIndentityProvider, suportedStorageProviders } from '@src/services';
import AuthenticationService from '@src/services/AuthenticationService';
import { supportedLanguages } from '@src/utilities/util';
import { Context } from './';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state, actions }: Context, overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    (localStorage.getItem('themeAppearance') as PaletteMode) ?? 'auto';
  actions.setThemeAppearance(prefPaletteMode);

  //LANGUAGE
  const prefLanguageCode = localStorage.getItem('i18nextLng');
  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages.get(prefLanguageCode);
    state.language = prefLanguage
      ? prefLanguage
      : { code: 'en-CA', name: 'english', shortName: 'en' };
  }

  //Recent Files
  const recentFilesSTRING = localStorage.getItem('recentFiles') ?? '[]';
  const recentFiles: Resource[] = JSON.parse(recentFilesSTRING);
  state.recentDocuments = recentFiles;

  //Authenticate
  await actions.initiateUserProvider();
};

export const setThemeAppearance = ({ state, actions }: Context, value: PaletteMode) => {
  state.themeAppearance = value;

  const darkMode =
    value === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : value === 'light'
      ? false
      : true;

  actions.setDarkMode(darkMode);

  localStorage.setItem('themeAppearance', value);
};

export const setDarkMode = ({ state }: Context, value: boolean) => {
  state.darkMode = value;
  return state.darkMode;
};

//* AUTHENTICATION

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getLincsAauthenticationToken = async ({ state }: Context) => {
  await AuthenticationService.updateToken();
  const token = AuthenticationService.getToken();
  return token;
};

export const initiateUserProvider = async ({ state, actions }: Context) => {
  state.userAuthenticated = 'authenticating';
  const sessionAuthenticated = await AuthenticationService.init();

  if (!sessionAuthenticated) {
    return (state.userAuthenticated = false);
  }

  //Identity provider
  await actions.setupMainIdentityProvider();
  await actions.setUserProfile();
  await actions.setupStorageProvider(); //based on identity providers

  //
  state.userAuthenticated = sessionAuthenticated ?? false;
};

export const setupMainIdentityProvider = async ({ state, actions, effects }: Context) => {
  const token = await actions.getLincsAauthenticationToken();
  if (!token) return console.warn('No Authentication token');

  const identity_provider = AuthenticationService.getIdentityProvider();
  if (!identity_provider) return console.warn('No identity_provider');

  const IDPTokens = await effects.LincsApi.getExternalIDPTokens('lincs', identity_provider, token);
  if (!IDPTokens) return console.warn('No identity_provider tokens');

  const provider = setIndentityProvider({ IDPTokens, providerName: identity_provider });

  state.identityProviders[identity_provider] = provider;
};

export const setUserProfile = async ({ state, actions }: Context) => {
  const keyCloakProfile = await AuthenticationService.getUserData();
  const user = keyCloakProfile as User;
  state.user = user;

  if (!state.identityProviders) return;

  //augment user profile
  state.user.identities = {};
  await actions.getLinkedAccounts();

  //prefferedID
  const prefferedID = localStorage.getItem('prefIdProvider');
  //if not prefferedID, use the first identityProviders linked Account
  prefferedID
    ? (state.user.prefferedID = prefferedID)
    : actions.changePrefferedID(Object.keys(state.identityProviders)[0]);

  //use avatar from preffed ID
  state.user.avatar_url = user.identities[user.prefferedID]?.avatar_url ?? undefined;
};

export const setupStorageProvider = async ({ state, actions }: Context) => {
  const token = await actions.getLincsAauthenticationToken();
  if (!token) return console.warn('No Authentication token');

  const identity_provider = AuthenticationService.getIdentityProvider();
  if (!identity_provider) return console.warn('No identity_provider');

  if (!state.identityProviders) return;

  Object.values(state.identityProviders).forEach((iDProvider) => {
    actions._linkStorageProvider(iDProvider.name);
  });

  //prefferedStorage

  if (!state.user) return;
  //if not prefferrdStorage, use the first StorageProvider linked Account
  const prefferedStorage = localStorage.getItem('prefStorageProvider');

  prefferedStorage
    ? (state.user.prefStorageProvider = prefferedStorage)
    : actions.changePrefStorageProvider(state.storageProviders[0]);
};

export const linkAccount = async ({ actions, effects }: Context, identity_provider: string) => {
  const token = await actions.getLincsAauthenticationToken();
  if (!token) return console.warn('No Authentication token');

  const linkAccountUrl = await effects.LincsApi.linkAccount(identity_provider, token);
  return linkAccountUrl;
};

interface LinkedAccount {
  identityProvider: string;
  userId?: string;
  userName?: string;
}

export const getLinkedAccounts = async ({ state, actions, effects }: Context) => {
  if (!state.user) return;
  const token = await actions.getLincsAauthenticationToken();
  if (!token) return console.warn('No Authentication token');

  const linkedAccounts: LinkedAccount[] = await effects.LincsApi.getLinkedAccounts(token);
  if (!linkedAccounts || linkedAccounts.length === 0) return;

  for await (const account of linkedAccounts) {
    //IDENTITY
    const providerName = account.identityProvider;
    if (state.user.identities[providerName]) continue;

    const identityProvider = await actions._linkIdentityProvider(account);

    //STORAGE
    if (identityProvider) actions._linkStorageProvider(providerName);
  }

  return linkedAccounts;
};

export const _linkIdentityProvider = async (
  { state, actions, effects }: Context,
  { identityProvider: providerName, userId, userName }: LinkedAccount
) => {
  if (!state.user) return;

  const token = await actions.getLincsAauthenticationToken();
  if (!token) return console.warn('No Authentication token');

  const IDPTokens = await effects.LincsApi.getExternalIDPTokens('lincs', providerName, token);
  if (!IDPTokens) return console.warn('No identity_provider tokens');

  const provider = setIndentityProvider({ IDPTokens, providerName, userId, userName });

  const userDetails = await provider.getAuthenticatedUser(userId);
  if (!userDetails) return;

  state.identityProviders[providerName] = provider;
  state.user.identities[providerName] = userDetails;

  return provider;
};

export const _linkStorageProvider = ({ state }: Context, providerName: string) => {
  if (!suportedStorageProviders.includes(providerName as StorageProvider)) return;

  const storage = providerName as StorageProvider;
  if (state.storageProviders.includes(storage)) return;
  state.storageProviders = [...state.storageProviders, storage];
};

export const setSampleUser = ({ state }: Context) => {
  state.user = {
    email: 'sampleUser@sample.com',
    firstName: 'Sample',
    lastName: 'User',
    username: 'sampleUser',
    identities: {
      github: {
        id: 0,
        email: 'sampleUser@sample.com',
        name: 'Sample User',
        login: "lucaju",
        username: 'sampleUser',
      }
    },
    prefferedID: 'github',
    prefStorageProvider: 'github',
  };

  state.userAuthenticated = true;
};

//* UI

export const switchLanguage = ({ state }: Context, value: string) => {
  // const language = supportedLanguages[value];
  // state.language = language;
  // return value;

  const language = supportedLanguages.get(value) ?? {
    code: 'en-CA',
    name: 'english',
    shortName: 'en',
  };
  state.language = language;
  return value;
};

//* USER

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const signIn = ({ state }: Context) => {
  AuthenticationService.doLogin();
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const signOut = async ({ state }: Context) => {
  localStorage.clear();
  await AuthenticationService.doLogout();
};

export const changePrefferedID = ({ state }: Context, iDproviderName: string) => {
  if (!state.user) return;
  state.user.prefferedID = iDproviderName;
  localStorage.setItem('prefIdProvider', iDproviderName);

  state.user.avatar_url = state.user.identities[iDproviderName].avatar_url ?? undefined;

  return iDproviderName;
};

// Resource

export const setResource = async ({ state }: Context, resource: Resource) => {
  state.resource = { ...resource };
};

export const clearResource = async ({ state }: Context) => {
  state.resource = undefined;
};

// Provider
export const getIdentityProvider = ({ state }: Context, name: string) => {
  return state.identityProviders[name];
};

export const getStorageProviderAuth = ({ state, actions }: Context, name: string) => {
  const provider = actions.getIdentityProvider(name);
  if (!provider) return;
  return { name: provider.name, access_token: provider.getAccessToken() };
};

export const getStorageProvidersAuth = ({ state, actions }: Context) => {
  const providers: IProviderAuth[] = state.storageProviders.map((provider) => {
    const identityProvider = actions.getIdentityProvider(provider);
    return { name: identityProvider.name, access_token: identityProvider.getAccessToken() };
  });

  return providers;
};

export const changePrefStorageProvider = ({ state }: Context, StorageproviderName: string) => {
  if (!state.user) return;
  state.user.prefStorageProvider = StorageproviderName;
  localStorage.setItem('prefStorageProvider', StorageproviderName);
  return StorageproviderName;
};

export const openStorageDialog = async (
  { state }: Context,
  storageDialogState: Omit<StorageDialogState, 'open'>
) => {
  state.storageDialogState = { open: true, ...storageDialogState };
};

export const closeStorageDialog = async ({ state }: Context) => {
  state.storageDialogState = { open: false };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isStorageProviderSupported = ({ state }: Context, providerName: string) => {
  return suportedStorageProviders.includes(providerName as StorageProvider);
};

// Message

export const showMessageDialog = (
  { state }: Context,
  messageDialog: Omit<MessageDialog, 'open'>
) => {
  state.messageDialog = { open: true, ...messageDialog };
};

export const closeCloseMessageDialog = ({ state }: Context) => {
  state.messageDialog = { open: false };
};

//

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isValidXml = ({ state }: Context, string: string) => {
  const doc = new DOMParser().parseFromString(string, 'text/xml');
  const parsererror = doc.querySelector('parsererror');
  return !parsererror;
};

export const addToRecentDocument = ({ state }: Context, document: Resource) => {
  const { content, hash, url, ...recent } = document;

  if (
    recent.provider === undefined ||
    recent.owner === undefined ||
    recent.ownertype === undefined ||
    recent.repo === undefined ||
    recent.path === undefined ||
    recent.filename === undefined
  ) {
    return;
  }

  // if recent already in the list, remove (and subsequently add in the first position)
  state.recentDocuments = state.recentDocuments.filter(
    ({ provider, owner, ownertype, repo, path, filename }) =>
      `${provider}/${owner}/${ownertype}/${repo}/${path}/${filename}` !==
      `${recent.provider}/${recent.owner}/${recent.ownertype}/${recent.repo}/${recent.path}/${recent.filename}`
  );

  //add
  state.recentDocuments = [recent, ...state.recentDocuments];

  //limit
  state.recentDocuments = state.recentDocuments.filter((item, index) => index <= 3);

  localStorage.setItem('recentFiles', JSON.stringify(state.recentDocuments));
};

export const loadTemplate = async ({ effects }: Context, url: string) => {
  const documentString = await effects.localAPI.loadTemplate(url);
  return documentString;
};
