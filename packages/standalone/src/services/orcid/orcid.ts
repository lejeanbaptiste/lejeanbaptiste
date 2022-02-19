import axios from 'axios';
import type { IdentityProvider, AuthenticateProp } from '../IdentityProvider';

const BASE_URL = 'https://pub.sandbox.orcid.org/v2.1';

//  ---------- API
//https://pub.sandbox.orcid.org/v2.0/#/

const name = 'orcid';

let _access_token: string;
const getAccessToken = () => _access_token;

let _userId: string;
const getUserId = () => _userId;

let _userName: string;
const getUserName = () => _userName;

const authenticate = ({ access_token, IDPTokens, userId, userName }: AuthenticateProp) => {
  if (!access_token && IDPTokens) {
    access_token = IDPTokens.access_token as string;
    _userName = IDPTokens.orcid;
  }

  if (!access_token) throw new Error('No access token provided');

  _access_token = access_token;
  _userId = userId ?? '';
  _userName = userName ?? '';
};

const getAuthenticatedUser = async (userId?: string) => {
  if (!userId) userId = _userId;
  if (!userId || userId === '') throw new Error('No userID');

  const headers = { Accept: 'application/json' };
  const response = await axios.get(`${BASE_URL}/${userId}/person`, { headers });

  const { data } = response;

  const user = {
    ...data,
    name: `${data.name['given-names'].value} ${data.name['family-name'].value}`,
    username: data.name.path,
    uri: `https://orcid.org/${data.path}`,
  };

  return user;
};

export const OrcidIdentityProvider: IdentityProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
};
