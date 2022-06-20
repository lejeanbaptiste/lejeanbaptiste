import { Octokit } from '@octokit/rest';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import queryString from 'query-string';
import type { AuthenticateProp, IdentityProvider } from '../IdentityProvider';

let octokit: Octokit;
const name = 'github';

let _access_token: string;
const getAccessToken = () => _access_token;

let _userId: string;
const getUserId = () => _userId;

let _userName: string;
const getUserName = () => _userName;

// We chain together the calls to github as a series of chained promises, and pass
// the growing result as an object (strictly speaking, creating a copy of the object
// at each point in the chain, so no arguments are mutated) along the promise chain, ultimately returning
// the object, which holds the new document, new annotations, treeSHA, and commitSHA
// The document and annotations are new because we rewrite all the annotations to use
// new raw github URIs for the newly saved document and annotation files.

//  ---------- TYPES
octokit = new Octokit();

type GetAuthenticatedResponseDataType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.users.getAuthenticated
>;

//  ---------- API

/**
 * Authenticate the user for making calls to GitHub, using their OAuth token.
 * See {@link https://developer.github.com/v3/#authentication}
 * @param {String} token The OAuth access_token from GitHub
 */
const authenticate = ({ access_token, IDPTokens, userId, userName }: AuthenticateProp) => {
  if (!access_token && IDPTokens) {
    const GH_tokens = queryString.parse(IDPTokens);
    access_token = GH_tokens?.access_token as string;
  }
  if (!access_token) throw new Error('No access token provided');

  _access_token = access_token;
  _userId = userId ?? '';
  _userName = userName ?? '';

  octokit = new Octokit({ auth: access_token, userAgent: 'Leaf-Writer' });
};

/**
 * Get the details associated with the currently authenticated user.
 * See {@link https://developer.github.com/v3/users/#get-the-authenticated-user}
 * @returns {Promise<GetAuthenticatedResponseDataType>}
 */
const getAuthenticatedUser = async (): Promise<GetAuthenticatedResponseDataType> => {
  const response = await octokit.users.getAuthenticated();

  const { data } = response;
  const user = { ...data, username: data.login, uri: data.html_url };

  return user;
};

export const GithubIdentityProvider: IdentityProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
};
