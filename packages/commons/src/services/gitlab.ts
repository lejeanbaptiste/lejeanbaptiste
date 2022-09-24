import { log } from '@src/utilities';
import axios, { AxiosInstance } from 'axios';
import type { AuthenticateProp, IIdentityProvider } from './';

const BASE_URL = 'https://gitlab.com/api/v4';

//  ---------- API
//https://docs.gitlab.com/ee/api/api_resources.html

const name = 'gitlab';

let _access_token: string;
const getAccessToken = () => _access_token;

let _userId: string;
const getUserId = () => _userId;

let _userName: string;
const getUserName = () => _userName;

let axiosApi: AxiosInstance;

const authenticate = ({ access_token, IDPTokens, userId, userName }: AuthenticateProp) => {
  if (!access_token && IDPTokens) access_token = IDPTokens.access_token as string;
  if (!access_token) throw new Error('No access token provided');

  _access_token = access_token;
  _userId = userId ?? '';
  _userName = userName ?? '';

  axiosApi = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${_access_token}` },
  });
};

const getAuthenticatedUser = async (userId: string) => {
  const response = await axiosApi.get('/user').catch((error) => {
    log.error(error);
    return null;
  });

  if (!response) return null;

  const { data } = response;
  const user = { ...data, uri: data.web_url };

  return user;
};

export const GitlabIdentityProvider: IIdentityProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
};
