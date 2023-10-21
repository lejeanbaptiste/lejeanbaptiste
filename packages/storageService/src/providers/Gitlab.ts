import match from 'autosuggest-highlight/match';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Buffer } from 'buffer/';
import type * as T from '../types';
import type * as Types from '../types/Provider';
import type Provider from '../types/Provider';
import { log } from '../utilities';

const BASE_URL = 'https://gitlab.com/api/v4';

//  ---------- API
//https://docs.gitlab.com/ee/api/api_resources.html

// ------------- Internal types --------------

interface TextMatch {
  fragment: string;
  matches: {
    indices: [number, number];
    text: string;
  }[];
}

export interface SearchBlobsItem {
  name: string;
  type: 'file';
  path: string;
  text_matches: TextMatch[];
}

interface CheckForMergeRequest {
  branchHead: string;
  branchOrigin: string;
  repoId: string;
}

type ImportStatus = 'none' | 'scheduled' | 'failed' | 'started' | 'finished';

interface PoolProps {
  fn: (params: any) => Promise<any>;
  params?: any;
  validate?: (value: any) => boolean;
  interval?: number;
  maxAttempts?: number;
}

// --------------

export default class Gitlab implements Provider {
  readonly name = 'gitlab';

  private readonly axios: AxiosInstance;

  userId = '';
  username = '';

  /**
   * Authenticate the user for making calls to GitHub, using their OAuth token.
   * @param {access_token} token The OAuth access_token from Gitlab
   */
  constructor({ access_token }: Types.ProviderAuth) {
    if (!access_token) throw new Error('No access token provided');

    this.axios = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${access_token}` },
    });
  }

  private decodeContent(content: string) {
    return Buffer.from(content, 'base64').toString('utf8');
  }

  private parseHeaderLink(s: string) {
    const output: { [x: string]: string } = {};
    const regex = /<([^>]+)>; rel="([^"]+)"/g;

    let m;
    while ((m = regex.exec(s))) {
      const [, v, k] = m;
      output[k] = v;
    }

    return output;
  }

  async getAuthenticatedUser() {
    const response: AxiosResponse<any> | null = await this.axios.get('/user');
    if (!response) return undefined;

    const user: Types.AuthenticatedUser = {
      ...response.data,
      username: response.data.username,
      userId: response.data.id.toString(),
      id: response.data.id.toString(),
      type: 'user',
    };

    this.userId = user.id;
    this.username = user.username;

    return user;
  }

  async getDetailsForUser({ user: id, type }: Types.UserDetailParams) {
    const response: AxiosResponse<any> | null =
      type === 'organization'
        ? await this.axios.get(`/groups/${id}`).catch(() => null)
        : await this.axios.get(`/users/${id}`).catch(() => null);

    if (!response) return null;

    const user = response.data;
    if (type === 'organization') user.username = user.path;

    return user;
  }

  async getOrganizationsForAuthenticatedUser({ nextPage, per_page = 30 }: Types.PaginatorParams) {
    const response: AxiosResponse<any> | null = nextPage
      ? await this.axios.get(nextPage)
      : await this.axios.get(`/groups`, { params: { pagination: 'keyset', per_page } });

    if (!response) return null;

    const collection = response.data ?? [];
    const organization = collection.map((org: any) => {
      org.username = org.path;
      return org;
    });

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection: organization, nextPage: nextPageLink };
  }

  async getReposForOrganization({ orgId: id, nextPage, per_page = 60 }: Types.ReposForOrgsParams) {
    if (!id) return null;
    const response: AxiosResponse<any> | null = nextPage
      ? await this.axios.get(nextPage)
      : await this.axios.get(`/groups/${id}/projects`, {
          params: { pagination: 'keyset', per_page },
        });

    if (!response) return null;

    let collection = response.data ?? [];

    //add username attrb
    if (collection.length > 0) {
      collection = collection.map((repo: any) => {
        repo.owner = repo.namespace;
        repo.owner.username = repo.owner.path;
        return repo;
      });
    }

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection, nextPage: nextPageLink };
  }

  async getReposForAuthenticatedUser({
    collectionSource,
    nextPage,
    per_page = 60,
  }: Types.ReposParams) {
    let response: any;

    if (nextPage) {
      response = await this.axios.get(nextPage);
    } else {
      const access = collectionSource === 'collaborator' ? { membership: true } : { owned: true };
      response = await this.axios.get('/projects', { params: { per_page, ...access } });
    }

    let collection = response.data ?? [];

    if (collection.length > 0) {
      if (collectionSource === 'collaborator') {
        collection = collection.filter((repo: any) => repo.namespace.path !== this.username);
      }

      //add username attrb
      collection = collection.map((repo: any) => {
        repo.owner = repo.namespace;
        repo.owner.username = repo.owner.path;
        return repo;
      });
    }

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection, nextPage: nextPageLink };
  }

  async getReposForUser({ username, nextPage, per_page = 60 }: Types.ReposForUserParams) {
    let response: any;

    if (nextPage) {
      response = await this.axios.get(nextPage);
    } else {
      response = await this.axios.get(`/users/${username}/projects`, {
        params: {
          per_page,
          // min_access_level: 30
        },
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

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection, nextPage: nextPageLink };
  }

  async getRepo({ checkForkStatus, repoId }: Types.RepoParams) {
    const encodedPath = encodeURIComponent(repoId);
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${encodedPath}`)
      .catch((error) => {
        throw new Error(`Repository not found: ${error}`);
      });

    if (checkForkStatus) {
      //check status
      const validateForkCreation = (status: ImportStatus) => status === 'finished';
      await (<Promise<ImportStatus>>this.pool({
        fn: this.getImportStatus,
        params: response.data.id,
        validate: validateForkCreation,
      }).catch(() => {
        throw new Error('Fork is taking too long. Try again later.');
      }));
    }

    const repo: T.Repository = response.data;
    repo.owner = repo.namespace;
    repo.owner.username = repo.owner.path;

    return repo;
  }

  async getRepoContent({ path, branch, repoId }: Types.RepoContentParams) {
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${repoId}/repository/tree`, {
        params: { path, ref: branch },
      })
      .catch(() => null);

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
  }

  async getRepoContentRecursively({ path, branch, repoId }: Types.RepoContentParams) {
    const response: AxiosResponse<any> | null = await this.axios.get(
      `/projects/${repoId}/repository/tree`,
      {
        params: {
          path,
          ref: branch,
          recursive: true,
        },
      },
    );

    if (!response) return null;

    const repoTree = response.data ?? [];

    const tree = repoTree.map((item: any) => {
      const pathArray = item.path?.split('/');
      const name = pathArray?.pop() ?? '';
      const path = pathArray?.join('/') ?? '';
      const type = item.type === 'tree' ? 'folder' : 'file';

      return { name, path, type };
    });

    return tree;
  }

  async getRepoBranches({ repoId }: Types.RepoBranchesParams) {
    const response: AxiosResponse<any> | null = await this.axios.get(
      `${BASE_URL}/projects/${repoId}/repository/branches`,
    );
    if (!response) return null;
    return response.data;
  }

  async searchUsers(query: string) {
    const usersResponse: AxiosResponse<any> | null = await this.axios.get('/search', {
      params: { per_page: 5, scope: 'users', search: query },
    });
    if (!usersResponse) return [];

    const usersData = usersResponse.data ?? [];

    const userCollection: T.PublicRepository[] = usersData.map(
      ({ avatar_url, id, name, username }: any) => {
        return {
          avatar_url,
          id,
          name,
          type: 'user',
          username,
          provider: 'gitlab',
          uuid: `gitlab-user-${id}`,
        };
      },
    );

    let collection = userCollection ?? [];

    const groupCollection = await this.searchGroups(query);
    if (groupCollection) collection = [...userCollection, ...groupCollection];

    return collection;
  }

  async searchGroups(query: string) {
    const groupsResponse: AxiosResponse<any> | null = await this.axios.get('/groups', {
      params: { per_page: 5, search: query },
    });

    if (!groupsResponse) return null;

    const groupData = groupsResponse.data ?? [];

    const groupCollection: any[] = groupData.map((item: any) => ({
      avatar_url: item.avatar_url,
      id: item.id,
      name: item.full_name,
      type: 'organization',
      username: item.full_path,
    }));

    return groupCollection;
  }

  /**
   * Search for files based on a specific query.
   * See {@link https://docs.gitlab.com/ee/api/search.html#scope-blobs}
   * @param {String} query Where to search
   * @param {String} query The query
   * @param {String} extension Limit to files with this extension
   * @returns {Promise}
   */
  async searchBlobs({
    extension,
    repoId,
    query,
  }: Types.SearchBlobsParams): Promise<SearchBlobsItem[]> {
    let search = query;
    if (extension) search += ` extension:${extension}`;

    const response: AxiosResponse<any> | null = await this.axios.get(`/projects/${repoId}/search`, {
      params: { per_page: 30, scope: 'blobs', search },
    });

    if (!response) return [];

    const results = response.data ?? [];
    const searchResults: SearchBlobsItem[] = [];

    results.forEach((item: any) => {
      const duplicated = searchResults.find((sr) => sr.name === item.filename);
      if (duplicated) {
        if (duplicated.text_matches.length > 2) return;
        duplicated.text_matches.push({
          fragment: item.data,
          matches: [{ indices: match(item.data, query)[0], text: query }],
        });
        return;
      }

      const pathToFile = item.path.split('/');
      pathToFile.pop(); //remove filename from path

      const text_matches = [
        {
          fragment: item.data,
          matches: [{ indices: match(item.data, query)[0], text: query }],
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

    log.info(searchResults);

    return searchResults;
  }

  async getLatestCommit({ repoId, path = '' }: Types.GetLatestCommitParams) {
    if (!repoId) return null;

    const encodedPath = encodeURIComponent(path);
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${repoId}/repository/commits`, {
        params: { path: encodedPath },
      })
      .catch(() => null);

    if (!response) return null;

    const latest = response.data[0];

    const latestCommit: Types.LatestCommit = {
      authorEmail: latest.author_email,
      authorName: latest.author_name,
      date: latest.authored_date,
      html_url: latest.web_url,
      message: latest.message,
    };
    return latestCommit;
  }

  async getDocument({
    branch: ref,
    ownerUsername,
    path = '',
    repoId,
    repoName,
  }: Types.RepoContentParams): Promise<Types.DocumentDetails | null> {
    if (!repoId) return null;

    const encodedPath = encodeURIComponent(path);
    const response = await this.axios
      .get(`/projects/${repoId}/repository/files/${encodedPath}`, {
        params: { ref },
      })
      .catch(() => null);

    if (!response) return null;

    const { content, last_commit_id } = response.data;

    const document = {
      content: this.decodeContent(content),
      hash: last_commit_id,
      url: `https://gitlab.com/${ownerUsername}/${repoName}/-/raw/${ref}/${encodedPath}?ref_type=heads`,
      urlApi: `https://gitlab.com/api/v4/projects/${repoId}/repository/files/${encodedPath}/raw?ref=${ref}`,
    };

    return document;
  }

  /**
   * Create a new repo for the authenticated user.
   * See {@link https://docs.gitlab.com/ee/api/projects.html#create-project}
   * @param {String?} description The repo description
   * @param {Boolean?} isPrivate Is the repo private
   * @param {String} name The repo name
   * @returns {Promise<any>}
   */
  async createRepo({ description, isPrivate = false, name }: Types.CreateRepoParams) {
    const response: AxiosResponse<any> | null = await this.axios
      .post('/projects', {
        description,
        initialize_with_readme: true,
        name,
        visibility: isPrivate ? 'private' : 'public',
      })
      .catch(() => null);

    if (!response) return null;

    const repo = response.data;
    repo.owner = repo.namespace;
    repo.owner.username = repo.owner.path;

    return repo;
  }

  /**
   * Check group member's written permission
   * See {@link https://docs.gitlab.com/ee/api/members.html#get-a-member-of-a-group-or-project}
   * @param {String} orgName The repo description
   * @param {String} username The username name
   * @returns {Promise<boolean>}
   */
  async checkOrgMemberWritenPermission({
    orgId: groupId,
    userId,
  }: Types.CheckOrgMemberWrittenPermission) {
    if (!groupId || !userId) return false;
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/groups/${groupId}/members/${userId}`)
      .catch(() => null);

    if (!response) return false;

    if (response.data.access_level >= 30) return true; //Must be at least a `developer` (30)

    return false;
  }

  /**
   * Create a new repo for the authenticated user.
   * See {@link https://docs.gitlab.com/ee/api/projects.html#create-project}
   * @param {String?} description The repo description
   * @param {Boolean?} isPrivate Is the repo private
   * @param {String} name The repo name
   * @returns {Promise<any>}
   */
  async createRepoInOrg({ description, isPrivate, name, orgId }: Types.CreateRepoParams) {
    if (!orgId) return null;

    const response: AxiosResponse<any> | null = await this.axios
      .post('/projects', {
        description,
        initialize_with_readme: true,
        name,
        namespace_id: orgId,
        visibility: isPrivate ? 'private' : 'public',
      })
      .catch(() => null);

    if (!response) return null;

    const repo = response.data;
    repo.owner = repo.namespace;
    repo.owner.username = repo.owner.path;

    return repo;
  }

  /**
   * Check repo's user written permission
   * See {@link https://docs.gitlab.com/ee/api/members.html#get-a-member-of-a-group-or-project}
   * @param {String} repoId The repo id
   * @param {String} userId The user id
   * @returns {Promise<boolean>}
   */
  async checkRepoUserWritenPermission({ repoId, userId }: Types.CheckRepoUserWrittenPermission) {
    if (!repoId || !userId) return false;
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${repoId}/members/all/${userId}`)
      .catch(() => null);

    if (!response) return false;
    if (response.data.access_level >= 30) return true; //Must be at least a `developer` (30)

    return false;
  }

  /**
   * Save (i.e. create or update) a document.
   * See {@link https://docs.gitlab.com/ee/api/repository_files.html#create-new-file-in-repository}
   * @param {String} branch The branch
   * @param {String} message The commit_message
   * @param {String} path The path
   * @param {String} repoId The repo
   * @returns {Promise}
   */
  async createFolder({ branch, message, path, repoId }: Types.SaveDocument) {
    if (!repoId) return null;

    const filename = '.gitkeep';
    path = `${path}/${filename}`;
    const encodedPath = encodeURIComponent(path);

    const response: AxiosResponse<any> | null = await this.axios
      .post(`/projects/${repoId}/repository/files/${encodedPath}`, {
        branch,
        content: '',
        commit_message: message,
      })
      .catch(() => null);

    return response as any;
  }

  /**
   * Save (i.e. create or update) a document.
   * See {@link https://docs.gitlab.com/ee/api/repository_files.html#create-new-file-in-repository}
   * @param {String} branch The branch
   * @param {String} content The content
   * @param {String} message The commit message
   * @param {String} path The path
   * @param {String} repoId The repo
   * @param {String} hash The last_commit_id
   * @returns {Promise}
   */
  async saveDocument(params: Types.SaveDocument) {
    const { branch, path, repoId, hash } = params;
    if (!params.repoId) return null;

    const response = hash ? await this.updateFile(params) : await this.createFile(params);
    if (!response) return null;

    //get latest version
    const documentResponse = await this.getDocument({ branch, path, repoId });
    if (!documentResponse) return null;

    const updatedResource = { ...params, hash: documentResponse.hash };
    return updatedResource;
  }

  /**
   * Save (i.e. create or update) a document.
   * See {@link https://docs.gitlab.com/ee/api/repository_files.html#create-new-file-in-repository}
   * @param {String} branch The branch
   * @param {String} content The content
   * @param {String} message The commit_message
   * @param {String} path The path
   * @param {String} repoId The repo
   * @returns {Promise}
   */
  async createFile(params: Types.SaveDocument) {
    const { branch, content, message, path, repoId } = params;
    const encodedPath = encodeURIComponent(path);
    const response: AxiosResponse<any> | null = await this.axios
      .post(`/projects/${repoId}/repository/files/${encodedPath}`, {
        branch,
        content,
        commit_message: message,
      })
      .catch(() => null);

    if (!response) return;

    return params;
  }

  /**
   * Save (i.e. create or update) a document.
   * See {@link https://docs.gitlab.com/ee/api/repository_files.html#update-existing-file-in-repository}
   * @param {String} branch The branch
   * @param {String} content The content
   * @param {String} message The commit_message
   * @param {String} path The path
   * @param {String} repoId The repo id
   * @param {String} hash The last_commit_id
   * @returns {Promise}
   */
  async updateFile(params: Types.SaveDocument) {
    const { branch, content, message, path, repoId, hash } = params;
    if (!hash) return null;

    const encodedPath = encodeURIComponent(path);
    const response: AxiosResponse<any> | null = await this.axios
      .put(`/projects/${repoId}/repository/files/${encodedPath}`, {
        branch,
        content,
        commit_message: message,
        last_commit_id: hash,
      })
      .catch(() => null);

    if (!response) return;

    return params;
  }

  /**
   * Create a fork for the authenticated user.
   * See {@link https://docs.gitlab.com/ee/api/projects.html#fork-project}
   * @param {String} repoId The repo id
   * @returns {Promise}
   */
  async createFork({ repoId }: Types.CreateFork) {
    const response = await this.axios
      .post<T.Repository>(`/projects/${repoId}/fork`)
      // .catch(() => nullgetRepo);
      .catch((error) => {
        throw new Error(error);
      });

    const fork = response.data;

    //check status
    const validateForkCreation = (status: ImportStatus) => status === 'finished';
    await this.pool({
      fn: this.getImportStatus,
      params: response.data.id,
      validate: validateForkCreation,
    }).catch(() => {
      throw new Error('Fork is taking too long. Try again later.');
    });

    return fork;
  }

  /**
   * Pool an endpoint in regular intervals.
   * @param {Function} fn The the funcion to call
   * @param {any?} params the fn's params
   * @param {Function?} validate A validate functions
   * @param {Number?} interval The interval
   * @param {Number?} maxAttempts The max attempts
   * @returns {Promise}
   */
  private async pool({ fn, params, validate, interval = 10_000, maxAttempts = 12 }: PoolProps) {
    let attempts = 0;
    const fnToPoll = fn.bind(this);

    const executePoll = async (resolve: any, reject: any) => {
      const result = await fnToPoll(params);
      attempts++;

      if (validate && validate(result)) {
        return resolve(result);
      } else if (attempts === maxAttempts) {
        return reject(new Error('Exceeded max attempts'));
      } else {
        setTimeout(executePoll, interval, resolve, reject);
      }
    };

    return new Promise(executePoll);
  }

  /**
   * Get the status of an import.
   * See {@link https://docs.gitlab.com/ee/api/project_import_export.html#import-status}
   * @param {ImportStatus} repoId The repo id
   * @returns {Promise}
   */
  async getImportStatus(repoId: string) {
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${repoId}/import`)
      .catch(() => null);

    if (!response) return 'none';
    return response.data.import_status as ImportStatus;
  }

  /**
   * Get a single repository branch
   * See {@link https://docs.gitlab.com/ee/api/branches.html#get-single-repository-branch}
   * @param {String} branch The branch
   * @param {String} repoId The repository
   * @returns {Promise}
   */
  async getBranch({ branch, repoId }: Types.GetBranch) {
    if (!repoId) return null;
    const response: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${repoId}/repository/branches/${branch}`)
      .catch(() => null);

    if (!response) return null;
    return response.data;
  }

  /**
   * Check if branch exists
   * @param {String} branch The branch
   * @param {String} repoId The repository
   * @returns {Promise<boolean>}
   */
  async checkForBranch({ branch, repoId }: Types.GetBranch) {
    const response = await this.getBranch({ branch, repoId });
    if (!response) return false;
    return true;
  }

  /**
   * Create new branch in the repository.
   * See {@link https://docs.gitlab.com/ee/api/branches.html#create-repository-branch}
   * @param {String} branchOrigin The branch origin
   * @param {String} branchTarget The new branch
   * @param {String} repoId The repo
   * @param {String} ownerUsername The owner username
   * @returns {Promise}
   */
  async createBranch({ repoId, branchOrigin, branchTarget }: Types.CreateBranch) {
    if (!repoId) return null;

    const response: AxiosResponse<any> | null = await this.axios
      .post(`/projects/${repoId}/repository/branches`, {
        branch: branchTarget,
        ref: branchOrigin,
      })
      .catch(() => null);

    if (!response) return;
    return response.data;
  }

  /**
   * Check for merfe request
   * See {@link https://docs.gitlab.com/ee/api/merge_requests.html#list-project-merge-requests}
   * @param {String} branchHead he branch head
   * @param {String} branchOrigin The branch origin
   * @param {String} repoId The repository ID
   * @returns {Promise}
   */
  private async checkForMergeRequest({ branchHead, branchOrigin, repoId }: CheckForMergeRequest) {
    const mergeRequests: AxiosResponse<any> | null = await this.axios
      .get(`/projects/${repoId}/merge_requests`, {
        params: {
          state: 'opened',
          source_branch: branchHead,
          target_branch: branchOrigin,
        },
      })
      .catch(() => null);

    if (!mergeRequests) return false;

    return mergeRequests.data.length > 0;
  }

  /**
   * Save (i.e. create) a document as a pull request.
   * See {@link https://docs.gitlab.com/ee/api/merge_requests.html#create-mr}
   * @param {String} branchOrigin The branch origin
   * @param {String} branchHead he branch head
   * @param {String} repoId The repo
   * @param {String} title The title of the pull request
   * @returns {Promise<Types.CreatePrResponse>}
   */
  async createPullRequest({ branchOrigin, branchHead, origin, title }: Types.CreatePrParams) {
    // there can be only one PR per branch */
    const doesMergeRequestExist = await this.checkForMergeRequest({
      branchOrigin,
      branchHead,
      repoId: origin.id,
    });

    if (doesMergeRequestExist) return 'exists';

    //? use "target_project_id" for cross origin?

    const pullRequest: AxiosResponse<any> | null = await this.axios
      .post(`/projects/${origin.id}/merge_requests`, {
        source_branch: branchHead,
        target_branch: branchOrigin,
        title,
      })
      .catch(() => null);

    if (!pullRequest) return null;

    return 'created';
  }

  /**
   * Create a pull request from a fork.
   * See {@link https://docs.gitlab.com/ee/api/merge_requests.html#create-mr}
   * @param {String} branchBase The branch origin
   * @param {String} branchHead he branch head
   * @param {String} repoId The repo
   * @param {String} title The title of the pull request
   * @returns {Promise<Types.CreatePrResponse>}
   */
  async createPullRequestFromFork({ fork, origin, title }: Types.CreatePrFromForkProps) {
    // there can be only one PR per branch */
    const doesMergeRequestExist = await this.checkForMergeRequest({
      branchOrigin: origin.default_branch,
      branchHead: fork.default_branch,
      repoId: origin.id,
    });

    if (doesMergeRequestExist) return 'exists';

    const pullRequest: AxiosResponse<any> | null = await this.axios
      .post(`/projects/${fork.id}/merge_requests`, {
        source_branch: fork.default_branch,
        target_branch: origin.default_branch,
        target_project_id: origin.id,
        title,
      })
      .catch(() => null);

    if (!pullRequest) return null;

    return 'created';
  }
}
