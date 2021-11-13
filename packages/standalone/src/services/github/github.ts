/**
 * Module providing GitHub API calls.
 * @module src/index
 */

import { Octokit } from '@octokit/rest';
import {
  GetResponseDataTypeFromEndpointMethod,
  GetResponseTypeFromEndpointMethod,
} from '@octokit/types';
import axios from 'axios';
import queryString from 'query-string';
import type { AuthenticateProp, IdentityProvider } from '../IdentityProvider';
import type * as SPTypes from '../StorageProvider';
import Buffer from 'buffer/';

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

type GetAuthenticatedResponseType = GetResponseTypeFromEndpointMethod<
  typeof octokit.users.getAuthenticated
>;
type GetAuthenticatedResponseDataType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.users.getAuthenticated
>;
type GetDetailsForUser = GetResponseDataTypeFromEndpointMethod<typeof octokit.users.getByUsername>;
type GetReposForAuthenticatedUser = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.listForAuthenticatedUser
>;
type GetReposForUser = GetResponseDataTypeFromEndpointMethod<typeof octokit.repos.listForUser>;
type GetRepoContentResponse = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.getContent
>;

type GetOrgsResponse = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.orgs.listForAuthenticatedUser
>;

type GetRepoForOrgResponse = GetResponseDataTypeFromEndpointMethod<typeof octokit.repos.listForOrg>;

type SearchUserResponse = GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.search.users>;

type SearchCodeResponse = GetResponseDataTypeFromEndpointMethod<typeof octokit.search.code>;

//  ---------- API

//Encoding & Decoding
// const _encodeContent = (content: string) => Buffer.from(content).toString('base64');
// const _decodeContent = (content: string) => Buffer.from(content, 'base64').toString('utf8');

//parse heaader link attr
const parseHeaderLink = (s: string) => {
  const output: { [x: string]: string } = {};
  const regex = /<([^>]+)>; rel="([^"]+)"/g;

  let m;
  while ((m = regex.exec(s))) {
    const [_, v, k] = m;
    output[k] = v;
  }

  return output;
};

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

  octokit = new Octokit({
    auth: access_token,
    userAgent: 'CWRC-Writer',
  });
};

/**
 * Get the details associated with the currently authenticated user.
 * See {@link https://developer.github.com/v3/users/#get-the-authenticated-user}
 * @returns {Promise<GetAuthenticatedResponseDataType>}
 */
const getAuthenticatedUser = async (): Promise<GetAuthenticatedResponseDataType> => {
  const response = await octokit.users.getAuthenticated();
  return response.data;
};

/**
 * Get the details for a specific user.
 * See {@link https://developer.github.com/v3/users/#get-a-single-user}
 * @param {string} user the username
 * @returns {Promise<GetDetailsForUser>}
 */
const getDetailsForUser = async ({
  user: username,
}: SPTypes.GetUserDetailParams): Promise<GetDetailsForUser | null> => {
  const response = await octokit.users.getByUsername({ username }).catch((error) => null);
  if (!response) return null;
  const user = response.data as any;
  user.username = user.login;
  return user;
};

/**
 * Get the repos the user has explicit permission to access.
 * See {@link https://developer.github.com/v3/repos/#list-your-repositories}
 * @param {string} affiliation User's relation to the repo
 * @param {number} page The page number = 1
 * @param {number} per_page Repos per page = 60
 * @returns {Promise}
 */
const getReposForAuthenticatedUser = async ({
  affiliation,
  nextPage,
  per_page = 20,
}: SPTypes.GetReposParams): Promise<{
  collection: any[]; //GetReposForAuthenticatedUser;
  nextPage: string | null;
} | null> => {
  let response: any;

  response = nextPage
    ? await axios.get(nextPage, { headers: { Authorization: `Bearer ${_access_token}` } })
    : await octokit.rest.repos.listForAuthenticatedUser({ affiliation, per_page });

  let collection = response.data as any[];
  if (affiliation !== 'owner') collection = await _expandReposWIthUserDetails(collection);

  //add username attr
  collection = collection.map((repo: any) => {
    repo.owner.username = repo.owner?.login;
    return repo;
  });

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection,
    nextPage: nextPageLink,
  };
};

const _expandReposWIthUserDetails = async (collection: any) => {
  const users: any[] = [];

  for (const repo of collection) {
    let user = users.find((usr) => usr.id === repo.owner.id);
    if (!user) user = await getDetailsForUser({ user: repo.owner.login });
    if (!user) continue;
    users.push(user);
    repo.owner = user;
  }

  return collection;
};

/**
 * Get the repos for a specific user.
 * See {@link https://developer.github.com/v3/repos/#list-user-repositories}
 * @param {string} username The username
 * @param {number} page The page number = 1
 * @param {number} per_page Repos per page = 60
 * @returns {Promise}
 */
const getReposForUser = async ({
  username,
  nextPage,
  per_page = 60,
}: SPTypes.GetReposParamsForUser): Promise<{
  collection: any[];
  nextPage: string | null;
} | null> => {
  const response = nextPage
    ? await axios.get(nextPage, { headers: { Authorization: `Bearer ${_access_token}` } })
    : await octokit.repos.listForUser({ username, per_page });

  let collection = response.data as any[];

  //add username attr
  collection = collection.map((repo: any) => {
    repo.owner.username = repo.owner?.login;
    return repo;
  });

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection,
    nextPage: nextPageLink,
  };
};

/**
 * Get the repo for a specific user.
 * See {@link https://docs.github.com/en/rest/reference/repos#get-a-repository}
 * @param {string} username The owner name
 * @param {string} repoName The repo name
 * @returns {Promise}
 */
const getRepo = async ({ username, repoName }: SPTypes.GetRepoParams): Promise<any | null> => {
  const response = await octokit.rest.repos
    .get({ owner: username, repo: repoName })
    .catch((error) => null);
  if (!response) return null;
  const repo = response.data as any;
  if (repo) repo.owner.username = repo.owner?.login;
  return repo;
};

/**
 * Gets the contents of a file or directory in a repository.
 * See {@link https://octokit.github.io/rest.js/v18#repos-get-contents}
 * @param {string} owner The owner
 * @param {string} path The path parin the repo
 * @param {string} ref The name of the commit/branch/tag. Default: the repository’s default branch (usually master)
 * @param {string} repo Repo name
 * @returns {Promise}
 */
const getRepoContent = async ({
  owner,
  repoName,
  path,
  branch,
}: SPTypes.GetRepoContentParams): Promise<GetRepoContentResponse | null> => {
  const response = await octokit.rest.repos
    .getContent({ owner, repo: repoName, path, ref: branch })
    .catch((error) => null);

  if (!response) return null;

  let content = response.data ?? [];

  if (Array.isArray(content)) {
    content = content.map((item: any) => {
      item.type = item.type === 'dir' ? 'folder' : item.type;
      return item;
    });
  } else {
    content.type = content.type === 'dir' ? 'folder' : content.type;
  }

  return content;
};

const getRepoBranches = async ({ owner, repoName }: SPTypes.GetRepoBranchesParams) => {
  if (!owner) return;
  const response = await octokit.request(`GET /repos/${owner}/${repoName}/branches`);
  console.log(response);

  return response.data;
};

const getOrganizationsForAuthenticatedUser = async ({
  nextPage,
  per_page = 60,
}: SPTypes.ParamsPaginator): Promise<{
  collection: any[];
  nextPage: string | null;
} | null> => {
  const response = nextPage
    ? await axios.get(nextPage, { headers: { Authorization: `Bearer ${_access_token}` } })
    : await octokit.orgs.listForAuthenticatedUser({ per_page });

  const collection = response.data ?? [];
  const organizaions = [];

  for (const org of collection) {
    const orgDetails = await getDetailsForUser({ user: org.login });
    if (!orgDetails) continue;
    organizaions.push({ username: org.login, ...orgDetails });
  }

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection: organizaions,
    nextPage: nextPageLink,
  };
};

const getReposForOrganization = async ({
  name,
  nextPage,
  per_page = 60,
}: SPTypes.ParamsGetReposForOrgs): Promise<{
  collection: any[];
  nextPage: string | null;
} | null> => {
  if (!name) return null;
  const org = name;

  const response = nextPage
    ? await axios.get(nextPage, { headers: { Authorization: `Bearer ${_access_token}` } })
    : await octokit.repos.listForOrg({ org, per_page });

  let collection = response.data ?? [];

  //add username attr
  collection = collection.map((repo: any) => {
    repo.owner.username = repo.owner?.login;
    return repo;
  });

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection,
    nextPage: nextPageLink,
  };
};

const searchUsers = async (query: string): Promise<SPTypes.UserLite[]> => {
  const response = await octokit.rest.search.users({ q: query, per_page: 10 });

  let collection = response.data.items ?? [];

  const userCollection: SPTypes.UserLite[] = [];

  for (const item of collection) {
    const detail = await getDetailsForUser({ user: item.login });
    const user: SPTypes.UserLite = {
      avatar_url: item.avatar_url,
      id: item.id,
      name: (detail?.name as string) ?? '',
      type: item.type === 'organization' ? 'organization' : 'user',
      username: item.login,
    };
    userCollection.push(user);
  }

  return userCollection;
};

/**
 * Search for files based on a specific query.
 * See {@link https://developer.github.com/v3/search/#search-code}
 * @param {String} owner user
 * @param {String} query The query
 * @returns {Promise}
 */
const searchBlobs = async ({ owner, query }: SPTypes.SearchBlobsParams): Promise<any[]> => {
  const response = await octokit.search.code({
    mediaType: { format: 'text-match' },
    per_page: 10,
    q: `language:xml ${query} user:${owner}`,
  });

  const results = response.data.items ?? [];

  const searchResults = results.map((item: any) => {
    let pathToFile = item.path.split('/');
    pathToFile.pop(); //remove filename from path

    item.repository.owner.username = item.repository.owner?.login;

    const simplifiedItem = {
      name: item.name,
      type: 'file',
      owner: item.repository.owner,
      path: pathToFile.join('/'),
      repository: item.repository,
      score: item.score,
      text_matches: item.text_matches,
    };

    return simplifiedItem;
  });

  return searchResults;
};

/**
 * Search for files based on a specific query.
 * See {@link https://developer.github.com/v3/search/#search-code}
 * @param {String} owner user
 * @param {String} repoName The repository
 * @param {String} repoName The branch
 * @returns {Promise}
 */
const getRepoContentRecursively = async ({
  owner,
  repoName,
  branch,
}: SPTypes.GetRepoContentParams): Promise<any[] | null> => {
  const branchShas = await _getBranchSHAs({ owner, repo: repoName, branch });

  const response = await octokit.rest.git.getTree({
    owner,
    repo: repoName,
    tree_sha: branchShas.baseTreeSHA,
    recursive: 'true',
  });

  if (response.data.truncated) return null;

  const repoTree = response.data.tree ?? [];

  const tree = repoTree.map((item) => {
    const pathArray = item.path?.split('/');
    const name = pathArray?.pop() ?? '';
    const path = pathArray?.join('/') ?? '';
    const type = item.type === 'tree' ? 'folder' : 'file';

    return { name, path, type };
  });

  return tree;
};

interface GetBranchSHAsParams {
  owner: string;
  repo: string;
  branch: string;
}

const _getBranchSHAs = async ({ owner, repo, branch }: GetBranchSHAsParams) => {
  const response = await octokit.rest.repos.getBranch({ owner, repo, branch });

  return {
    baseTreeSHA: response.data.commit.commit.tree.sha,
    parentCommitSHA: response.data.commit.sha,
  };
};

/**
 * Get a document from GitHub.
 * See {@link https://developer.github.com/v3/repos/contents/#get-contents}
 * See {@link https://octokit.github.io/rest.js/#octokit-routes-repos-get-contents}
 * @param {String} owner The owner
 * @param {String} repo The reponame
 * @param {String} ref The branch/tag
 * @param {String} path The path
 * @returns {Promise}
 */
const getDocument = async ({
  owner,
  path,
  branch,
  repoName: repo,
}: SPTypes.GetRepoContentParams): Promise<SPTypes.DocumentDetails> => {
  console.log({ owner, path, branch, repo });

  const result = await octokit.repos.getContent({ owner, path, ref: branch, repo });

  //@ts-ignore
  const { content } = result.data;
  console.log(content);
  // if (content) console.log(_decodeContent(content));

  // return {
  //   document: _decodeContent(result.data.content),
  //   sha: result.data.sha,
  // };

  return {
    document: '',
    sha: '',
  };
};

export const GithubIdentityProvider: IdentityProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
};

export const GithubStorageProvider: SPTypes.StorageProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
  getDetailsForUser,
  getReposForAuthenticatedUser,
  getRepoContent,
  getRepoContentRecursively,
  getRepoBranches,
  getReposForUser,
  getOrganizationsForAuthenticatedUser,
  getReposForOrganization,
  searchUsers,
  searchBlobs,
  getDocument,
  getRepo,
};
