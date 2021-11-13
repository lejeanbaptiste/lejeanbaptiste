import axios, { AxiosInstance } from 'axios';
import type { AuthenticateProp, IdentityProvider } from '../IdentityProvider';
import type * as SPTypes from '../StorageProvider';
import match from 'autosuggest-highlight/match';

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
  const response = await axiosApi.get(`/users/${userId}`);
  return response.data;
};

const getDetailsForUser = async ({
  user: id,
  type,
}: SPTypes.GetUserDetailParams): Promise<any | null> => {
  const response =
    type === 'organization'
      ? await axiosApi.get(`/groups/${id}`).catch((error) => null)
      : await axiosApi.get(`/users/${id}`).catch((error) => null);

  if (!response) return null;

  const user = response.data;
  if (type === 'organization') user.username = user.path;

  return user;
};

const getOrganizationsForAuthenticatedUser = async ({
  nextPage,
  per_page = 30,
}: SPTypes.ParamsPaginator): Promise<{
  collection: any[];
  nextPage: string | null;
}> => {
  const response = nextPage
    ? await axiosApi.get(nextPage)
    : await axiosApi.get(`/groups`, { params: { pagination: 'keyset', per_page } });

  const collection = response.data ?? [];
  const organization = collection.map((org: any) => {
    org.username = org.path;
    return org;
  });

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection: organization,
    nextPage: nextPageLink,
  };
};

const getReposForOrganization = async ({
  id,
  nextPage,
  per_page = 60,
}: SPTypes.ParamsGetReposForOrgs): Promise<{
  collection: any[];
  nextPage: string | null;
}> => {
  let response: any;

  if (nextPage) {
    response = await axiosApi.get(nextPage);
  } else {
    response = await axiosApi.get(`/groups/${id}/projects`, {
      params: { pagination: 'keyset', per_page },
    });
  }

  let collection = response.data ?? [];

  //add username attrb
  if (collection.length > 0) {
    collection = collection.map((repo: any) => {
      repo.owner = repo.namespace;
      repo.owner.username = repo.owner.path;
      return repo;
    });
  }

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection,
    nextPage: nextPageLink,
  };
};

const getReposForAuthenticatedUser = async ({
  affiliation,
  nextPage,
  per_page = 60,
}: SPTypes.GetReposParams): Promise<{
  collection: any[];
  nextPage: string | null;
}> => {
  let response: any;

  if (nextPage) {
    response = await axiosApi.get(nextPage);
  } else {
    const access = affiliation === 'collaborator' ? { membership: true } : { owned: true };

    response = await axiosApi.get('/projects', { params: { per_page, ...access } });
  }

  let collection = response.data ?? [];

  if (collection.length > 0) {
    //if affiliation === 'collaborator' filter out: onwned repositories
    if (affiliation === 'collaborator') {
      collection = collection.filter((repo: any) => repo.namespace.path !== _userName);
    }

    //add username attrb
    collection = collection.map((repo: any) => {
      repo.owner = repo.namespace;
      repo.owner.username = repo.owner.path;
      return repo;
    });
  }

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection,
    nextPage: nextPageLink,
  };
};

const getReposForUser = async ({
  username,
  nextPage,
  per_page = 60,
}: SPTypes.GetReposParamsForUser): Promise<{
  collection: any[];
  nextPage: string | null;
}> => {
  let response: any;

  if (nextPage) {
    response = await axiosApi.get(nextPage);
  } else {
    response = await axiosApi.get(`/users/${username}/projects`, {
      params: { per_page, min_access_level: 30 },
    });
  }

  let collection = response.data;

  if (response.data.length > 0) {
    //add username attrb
    collection = collection.map((repo: any) => {
      repo.owner = repo.namespace;
      repo.owner.username = repo.owner.path;
      return repo;
    });
  }

  const headerLinks = response.headers.link ? parseHeaderLink(response.headers.link) : null;
  const nextPageLink = headerLinks ? headerLinks.next : null;

  return {
    collection,
    nextPage: nextPageLink,
  };
};

const getRepo = async ({ repoName: id }: SPTypes.GetRepoParams): Promise<any | null> => {
  const response = await axiosApi.get(`/projects/${id}`).catch((error) => null);
  if (!response) return null;

  const repo = response.data;
  repo.owner = repo.namespace;
  repo.owner.username = repo.owner.path;

  return repo;
};

const getRepoContent = async ({
  path,
  branch,
  repoId,
}: SPTypes.GetRepoContentParams): Promise<any | null> => {
  const response = await axiosApi
    .get(`/projects/${repoId}/repository/tree`, {
      params: { path, ref: branch },
    })
    .catch((error) => null);

  if (!response) return null;

  let content = response.data;
  if (Array.isArray(content)) {
    content = content.map((item: any) => {
      item.type = item.type === 'tree' ? 'folder' : item.type === 'bloob' ? 'file' : item.type;
      return item;
    });
  } else {
    content.type =
      content.type === 'tree' ? 'folder' : content.type === 'blob' ? 'file' : content.type;
  }

  return content;
};

const getRepoContentRecursively = async ({
  path,
  branch,
  repoId,
}: SPTypes.GetRepoContentParams): Promise<any[] | null> => {
  const response = await axiosApi.get(`/projects/${repoId}/repository/tree`, {
    params: { path, ref: branch, recursive: true },
  });

  if (!response.data) return null;

  const repoTree = response.data ?? [];

  const tree = repoTree.map((item: any) => {
    const pathArray = item.path?.split('/');
    const name = pathArray?.pop() ?? '';
    const path = pathArray?.join('/') ?? '';
    const type = item.type === 'tree' ? 'folder' : 'file';

    return { name, path, type };
  });

  return tree;
};

const getRepoBranches = async ({ repoId }: SPTypes.GetRepoBranchesParams) => {
  const response = await axiosApi.get(`${BASE_URL}/projects/${repoId}/repository/branches`);
  return response.data;
};

const searchUsers = async (query: string): Promise<SPTypes.UserLite[]> => {
  const usersResponse = await axiosApi.get('/search', {
    params: { per_page: 5, scope: 'users', search: query },
  });
  const usersData = usersResponse.data ?? [];
  console.log(usersData);

  const userCollection: SPTypes.UserLite[] = usersData.map(
    ({ avatar_url, id, name, username }: Omit<SPTypes.UserLite, 'type'>) => ({
      avatar_url,
      id,
      name,
      type: 'user',
      username,
    })
  );

  const groupsResponse = await axiosApi.get('/groups', { params: { per_page: 5, search: query } });
  const groupData = groupsResponse.data ?? [];
  console.log(groupData);

  const groupCollection: SPTypes.UserLite[] = groupData.map((item: any) => ({
    avatar_url: item.avatar_url,
    id: item.id,
    name: item.full_name,
    type: 'organization',
    username: item.full_path,
  }));

  const collection = [...userCollection, ...groupCollection];
  return collection;
};

interface TextMatch {
  fragment: String;
  matches: {
    indices: [number, number];
    text: string;
  }[];
}

interface SearchBlobsItem {
  name: string;
  type: 'file';
  path: string;
  text_matches: TextMatch[];
}

const searchBlobs = async ({
  repoId,
  query,
}: SPTypes.SearchBlobsParams): Promise<SearchBlobsItem[]> => {
  const response = await axiosApi.get(`/projects/${repoId}/search`, {
    params: { per_page: 30, scope: 'blobs', search: `${query} extension:xml` },
  });

  const results = response.data ?? [];
  const searchResults: SearchBlobsItem[] = [];

  results.forEach((item: any) => {
    const duplicated = searchResults.find((sr) => sr.name === item.filename);
    if (duplicated) {
      if (duplicated.text_matches.length > 2) return;
      duplicated.text_matches.push({
        fragment: item.data,
        matches: [
          {
            indices: match(item.data, query)[0],
            text: query,
          },
        ],
      });
      return;
    }

    let pathToFile = item.path.split('/');
    pathToFile.pop(); //remove filename from path

    const text_matches = [
      {
        fragment: item.data,
        matches: [
          {
            indices: match(item.data, query)[0],
            text: query,
          },
        ],
      },
    ];

    const simplifiedItem: SearchBlobsItem = {
      name: item.filename,
      type: 'file',
      path: pathToFile.join('/'),
      text_matches,
    };

    searchResults.push(simplifiedItem);
  });

  return searchResults;
};

export const GitlabIdentityProvider: IdentityProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
};

export const GitlabStorageProvider: SPTypes.StorageProvider = {
  name,
  getAccessToken,
  getUserId,
  getUserName,
  authenticate,
  getAuthenticatedUser,
  getDetailsForUser,
  getReposForAuthenticatedUser,
  getOrganizationsForAuthenticatedUser,
  getRepoBranches,
  getRepoContent,
  getRepoContentRecursively,
  getReposForUser,
  getReposForOrganization,
  searchUsers,
  searchBlobs,
  getRepo,
};
