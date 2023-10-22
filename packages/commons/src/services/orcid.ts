// import axios from 'axios';
import type { AuthenticateProp, ProviderService } from './types';

// const BASE_URL = 'https://api.orcid.org/v3.0';
//const BASE_URL = https://pub.sandbox.orcid.org/v2.1/#/

const name = 'orcid';

const isIdentityProvider = true;
const isStorageProvider = false;

let _access_token: string;
const getAccessToken = () => _access_token;

let _userId: string;
const getUserId = () => _userId;

let _userName: string;
const getUserName = () => _userName;

const authenticate = ({ access_token, IDPTokens }: AuthenticateProp) => {
  if (!access_token && IDPTokens && typeof IDPTokens === 'object') {
    access_token = IDPTokens.access_token as string;
    _userName = IDPTokens.name as string;
    _userId = IDPTokens.orcid as string;
  }

  if (!access_token) throw new Error('No access token provided');
};

const getAuthenticatedUser = async (_userId?: string) => {
  //? Alternative
  //* return the data stored from the token
  // * it might be enough since LEAF-Writer only needs the user name and id.

  const user = {
    name: _userName,
    id: _userId,
    uri: `https://orcid.org/${_userId}`,
  };

  return user;
};

export const provider: ProviderService = {
  name,
  isIdentityProvider,
  isStorageProvider,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
};
