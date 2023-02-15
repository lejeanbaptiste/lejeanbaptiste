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
  if (!access_token && IDPTokens) {
    access_token = IDPTokens.access_token;
    _userName = IDPTokens.name;
    _userId = IDPTokens.orcid;
  }

  if (!access_token) throw new Error('No access token provided');
};

const getAuthenticatedUser = async (userId?: string) => {
  //? This block should be used to fetch user data from ORCID API
  // * However, the request can only be made by HTTPS conenction (no localhost)
  // * and might be only possible make the request from the domain of the assignned callbak URL.
  // if (!userId) userId = _userId;
  // if (!userId || userId === '') throw new Error('No userID');

  // const headers = { Accept: 'application/json', Authorization: `Bearer ${_access_token}` };
  // const response = await axios.get(`${BASE_URL}/${userId}/person`, { headers });

  // const { data } = response;

  // const user = {
  //   ...data,
  //   name: `${data.name['given-names'].value} ${data.name['family-name'].value}`,
  //   username: data.name.path,
  //   uri: `https://orcid.org/${data.path}`,
  // };

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
