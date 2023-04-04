/**
 * Module providing GitHub API calls.
 * @module github
 */

import { Octokit } from '@octokit/rest';
import axios, { type AxiosInstance } from 'axios';
import { Buffer } from 'buffer/';
import type * as T from '../types';
import { isErrorMessage } from '../types';
import type * as Types from '../types/Provider';
import type Provider from '../types/Provider';

// ------------- Internal types --------------

interface CheckForPullRequest {
  branch: string;
  ownerUsername: string;
  repoName: string;
  title: string;
}

// --------------

export default class Github implements Provider {
  readonly name = 'github';

  private readonly octokit: Octokit;
  private readonly axios: AxiosInstance;

  userId = '';
  username = '';

  /**
   * Authenticate the user for making calls to GitHub, using their OAuth token.
   * See {@link https://developer.github.com/v3/#authentication}
   * @param {access_token} token The OAuth access_token from GitHub
   */
  constructor({ access_token }: Types.ProviderAuth) {
    if (!access_token) throw new Error('No access token provided');

    this.axios = axios.create({
      headers: { Authorization: `Bearer ${access_token}` },
    });

    this.octokit = new Octokit({
      auth: access_token,
      userAgent: 'leaf-writer-storage-service',
    });
  }

  private encodeContent(content: string) {
    return Buffer.from(content).toString('base64');
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

  /**
   * Get the details associated with the currently authenticated user.
   * See {@link https://developer.github.com/v3/users/#get-the-authenticated-user}
   * @returns
   */
  async getAuthenticatedUser() {
    const response = await this.octokit.users.getAuthenticated();
    if (!response) return null;

    const user = response.data as any;
    user.username = user.login;

    this.userId = user.id.toString();
    this.username = user.login;

    return user;
  }

  /**
   * Get the details for a specific user.
   * See {@link https://developer.github.com/v3/users/#get-a-single-user}
   * @param {string} user the username
   * @returns {Promise<GetDetailsForUser>}
   */
  async getDetailsForUser({ user: username }: Types.UserDetailParams) {
    const response = await this.octokit.users.getByUsername({ username }).catch(() => null);
    if (!response) return null;
    const user = response.data as any;
    user.username = user.login;
    return user;
  }

  /**
   * Get the repos the user has explicit permission to access.
   * See {@link https://developer.github.com/v3/repos/#list-your-repositories}
   * @param {string} collectionSource User's relation to the repo
   * @param {number} page The page number = 1
   * @param {number} per_page Repos per page = 60
   * @returns {Promise}
   */
  async getReposForAuthenticatedUser({
    collectionSource,
    nextPage,
    per_page = 20,
  }: Types.ReposParams) {
    const response: any = nextPage
      ? await this.axios.get(nextPage)
      : await this.octokit.rest.repos.listForAuthenticatedUser({
          affiliation: collectionSource,
          per_page,
        });

    let collection = response.data as any[];
    if (collectionSource !== 'owner')
      collection = await this.expandReposWIthUserDetails(collection);

    //add username attr
    collection = collection.map((repo: any) => {
      repo.owner.username = repo.owner?.login;
      return repo;
    });

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection, nextPage: nextPageLink };
  }

  private async expandReposWIthUserDetails(collection: any) {
    const users: any[] = [];

    for (const repo of collection) {
      let user = users.find((usr) => usr.id === repo.owner.id);
      if (!user) user = await this.getDetailsForUser({ user: repo.owner.login });
      if (!user) continue;
      users.push(user);
      repo.owner = user;
    }

    return collection;
  }

  /**
   * Get the repos for a specific user.
   * See {@link https://developer.github.com/v3/repos/#list-user-repositories}
   * @param {string} username The username
   * @param {number} page The page number = 1
   * @param {number} per_page Repos per page = 60
   * @returns {Promise}
   */
  async getReposForUser({ username, nextPage, per_page = 60 }: Types.ReposForUserParams) {
    const response = nextPage
      ? await this.axios.get(nextPage)
      : await this.octokit.repos.listForUser({ username, per_page });

    let collection = response.data as any[];

    //add username attr
    collection = collection.map((repo: any) => {
      repo.owner.username = repo.owner?.login;
      repo.writePermission = repo.permissions.push; //* This is a shortcut to check if the user has write permission someone else's repo
      return repo;
    });

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection, nextPage: nextPageLink };
  }

  /**
   * Get the repo for a specific user.
   * See {@link https://docs.github.com/en/rest/reference/repos#get-a-repository}
   * @param {string} username The owner name
   * @param {string} repoName The repo name
   * @returns {Promise}
   */
  async getRepo({ username, repoName }: Types.RepoParams) {
    const response = await this.octokit.rest.repos
      .get({ owner: username, repo: repoName })
      .catch((error) => {
        throw new Error(`Repository not found: ${error}`);
      });

    const repo = response.data as unknown as T.Repository;
    repo.owner.username = repo.owner?.login;
    repo.owner.path = repo.name;
    repo.writePermission = repo.permissions.push; //* This is a shortcut to check if the user has write permission someone else's repo

    return repo;
  }

  /**
   * Gets the contents of a file or directory in a repository.
   * See {@link https://this.octokit.github.io/rest.js/v18#repos-get-contents}
   * @param {string} ownerUsername The owner
   * @param {string} path The path parin the repo
   * @param {string} ref The name of the commit/branch/tag. Default: the repository’s default branch (usually master)
   * @param {string} repo Repo name
   * @returns {Promise}
   */
  async getRepoContent({
    ownerUsername,
    repoName,
    path = '',
    branch: ref,
  }: Types.RepoContentParams) {
    if (!ownerUsername || !repoName) return null;
    const response = await this.octokit.rest.repos
      .getContent({ owner: ownerUsername, repo: repoName, path, ref })
      .catch(() => null);

    if (!response) return null;

    let content = response.data ?? [];

    if (Array.isArray(content)) {
      content = content.map((item: any) => {
        item.type = item.type === 'dir' ? 'folder' : item.type;
        return item;
      });
    } else {
      // @ts-ignore
      content.type = content.type === 'dir' ? 'folder' : content.type;
    }

    return content;
  }

  async getRepoBranches({ owner, repoName }: Types.RepoBranchesParams) {
    if (!owner) return;
    const response = await this.octokit.request(`GET /repos/${owner}/${repoName}/branches`);
    return response.data;
  }

  async getOrganizationsForAuthenticatedUser({ nextPage, per_page = 60 }: Types.PaginatorParams) {
    const response = nextPage
      ? await this.axios.get(nextPage)
      : await this.octokit.orgs.listForAuthenticatedUser({ per_page });

    const collection: any = response.data ?? [];
    const organizaions = [];

    for (const org of collection) {
      const orgDetails = await this.getDetailsForUser({ user: org.login });
      if (!orgDetails) continue;
      organizaions.push({ username: org.login, description: orgDetails.bio, ...orgDetails });
    }

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection: organizaions, nextPage: nextPageLink };
  }

  async getOrganization({ orgName: org }: Types.GetOrganization) {
    if (!org) return null;

    const response = this.octokit.rest.orgs.get({ org }).catch(() => null);
    if (!response) return null;

    const organization = response as any;
    organization.username = organization.login;

    return organization;
  }

  async getReposForOrganization({
    orgUsername: org,
    nextPage,
    per_page = 60,
  }: Types.ReposForOrgsParams) {
    if (!org) return null;

    const response = nextPage
      ? await this.axios.get(nextPage)
      : await this.octokit.repos.listForOrg({ org, per_page });

    const collection: any = response.data ?? [];

    //add username attr
    const repositories = collection.map((repo: any) => {
      repo.owner.username = repo.owner?.login;
      repo.writePermission = repo.permissions.push; //* This is a shortcut to check if the user has write permission someone else's repo
      return repo;
    });

    const headerLinks = response.headers.link ? this.parseHeaderLink(response.headers.link) : null;
    const nextPageLink = headerLinks ? headerLinks.next : null;

    return { collection: repositories, nextPage: nextPageLink };
  }

  async searchUsers(query: string) {
    const response = await this.octokit.rest.search.users({ q: query, per_page: 10 });

    const collection = response.data.items ?? [];

    const userCollection: T.PublicRepository[] = [];

    for (const item of collection) {
      const detail = await this.getDetailsForUser({ user: item.login });
      const type = item.type.toLowerCase() === 'organization' ? 'organization' : 'user';

      const user: T.PublicRepository = {
        avatar_url: item.avatar_url,
        id: item.id.toString(),
        name: (detail?.name as string) ?? '',
        type,
        username: item.login,
        provider: 'github',
        uuid: `github-${type}-${item.id}`,
      };
      
      userCollection.push(user);
    }

    return userCollection;
  }

  /**
   * Search for files based on a specific query.
   * See {@link https://developer.github.com/v3/search/#search-code}
   * @param {String} owner Limit to files owner by this user
   * @param {String} query The query
   * @param {String} extension Limit to files with this extension
   * @returns {Promise}
   */
  async searchBlobs({ extension, owner, query }: Types.SearchBlobsParams): Promise<any> {
    let q = `${query} user:${owner}`;
    if (extension) q += ` language:${extension}`;

    const response = await this.octokit.search.code({
      mediaType: { format: 'text-match' },
      per_page: 10,
      q,
    });

    const results = response.data.items ?? [];

    const searchResults = results.map((item: any) => {
      const pathToFile = item.path.split('/');
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
  }

  /**
   * Get repository content recursevelly
   * See {@link https://docs.github.com/en/rest/reference/git#trees}
   * @param {String} branch The branch
   * @param {String} ownerUsername user
   * @param {String} repoName The repository
   * @returns {Promise}
   */
  async getRepoContentRecursively({ ownerUsername, repoName, branch }: Types.RepoContentParams) {
    if (!ownerUsername || !repoName) return null;
    const originBranch = await this.getBranch({ branch, ownerUsername, repoName });
    if (!originBranch) return null;

    const response = await this.octokit.rest.git.getTree({
      owner: ownerUsername,
      repo: repoName,
      tree_sha: originBranch.commit.commit.tree.sha,
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
  }

  /**
   * Latest commit
   * Based on {@link https://docs.github.com/en/rest/reference/commits#list-commits}
   * @param {String} ownerUsername user
   * @param {String} repoName The repository
   * @param {String} path The path (Optional)
   * @returns {Promise}
   */
  async getLatestCommit({ ownerUsername, repoName, path }: Types.GetLatestCommitParams) {
    if (!ownerUsername || !repoName) return null;

    const response = await this.octokit.rest.repos.listCommits({
      owner: ownerUsername,
      path,
      per_page: 1,
      repo: repoName,
    });

    if (!response) return null;

    const latest = response.data[0];
    const commit = latest.commit;

    const latestCommit: Types.LatestCommit = {
      authorEmail: commit.author?.email,
      authorName: commit.author?.name,
      date: commit.author?.date,
      html_url: latest.html_url,
      message: commit.message,
    };
    return latestCommit;
  }

  /**
   * Get a document from GitHub.
   * See {@link https://developer.github.com/v3/repos/contents/#get-contents}
   * See {@link https://this.octokit.github.io/rest.js/#this.octokit-routes-repos-get-contents}
   * @param {String} ownerUsername The owner
   * @param {String} repoName The repository name
   * @param {String} branch The branch/tag
   * @param {String} path The path
   * @returns {Promise}
   */
  async getDocument({
    ownerUsername: owner,
    path = '',
    branch: ref,
    repoName: repo,
  }: Types.RepoContentParams) {
    if (!owner || !repo) return null;

    const result = await this.octokit.repos
      .getContent({ owner, path, ref, repo })
      .catch(() => null);

    if (!result) return null;
    if (!('type' in result.data)) return null;

    const { download_url, sha } = result.data;

    // * When the file is > 1MB, the content returns empty.
    // * So, to normalize the request, we fetch the content blob.
    const blob = await this.octokit.rest.git.getBlob({ owner, repo, file_sha: sha });
    if (!blob.data) return null;

    const content = this.decodeContent(blob.data.content);
    const url =
      download_url ??
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encodeURIComponent(path)}`;

    return {
      content,
      hash: sha,
      url,
    };
  }

  /**
   * Create a new repo for the authenticated user.
   * See {@link https://octokit.github.io/rest.js/v18#repos}
   * @param {String?} description The repo description
   * @param {Boolean?} isPrivate Is the repo private
   * @param {String} name The repo name
   * @returns {Promise<any>}
   */
  async createRepo({ description, isPrivate = false, name }: Types.CreateRepoParams) {
    const response = await this.octokit.rest.repos
      .createForAuthenticatedUser({
        name,
        description,
        auto_init: true,
        private: isPrivate,
      })
      .catch(() => null);

    if (!response) return null;
    const repo = response.data as any;
    if (repo) repo.owner.username = repo.owner?.login;

    return repo;
  }

  /**
   * Create a new repo for a specific org.
   * See {@link https://octokit.github.io/rest.js/v18#repos-create-in-org}
   * @param {String?} description The repo description
   * @param {Boolean?} isPrivate Is the repo private
   * @param {String} name The repo name
   * @param {String} orgName The org name
   * @returns {Promise<any>}
   */
  async createRepoInOrg({ description, isPrivate, name, orgName }: Types.CreateRepoParams) {
    if (!orgName) return null;

    const response = await this.octokit.rest.repos
      .createInOrg({
        org: orgName,
        name,
        description,
        auto_init: true,
        private: isPrivate,
      })
      .catch(() => null);

    if (!response) return null;
    const repo = response.data as any;
    if (repo) repo.owner.username = repo.owner?.login;

    return repo;
  }

  /**
   * Check organization member's written permission
   * See {@link https://octokit.github.io/rest.js/v18#orgs-check-membership-for-user}
   * @param {String} orgName The repo description
   * @param {String} username The username name
   * @returns {Promise<boolean>}
   */
  async checkOrgMemberWritenPermission({
    orgName: org,
    username,
  }: Types.CheckOrgMemberWrittenPermission) {
    if (!org || !username) return false;

    const response = await this.octokit.rest.orgs
      .checkMembershipForUser({ org, username })
      .catch(() => null);

    if (!response) return false;
    if (response.status === 302) return false;

    return true;
  }

  /**
   * Check repo's user written permission
   * See {@link https://octokit.github.io/rest.js/v18#repos-get-collaborator-permission-level}
   * @param {String} repoName The repo name
   * @param {String} ownerUsername The repo owner
   * @param {String} username The username name
   * @returns {Promise<boolean>}
   */
  async checkRepoUserWritenPermission({
    repoName: repo,
    ownerUsername: owner,
    username,
  }: Types.CheckRepoUserWrittenPermission) {
    if (!repo || !owner || !username) return false;

    const response = await this.octokit.rest.repos
      .getCollaboratorPermissionLevel({ owner, repo, username })
      .catch(() => null);

    if (!response) return false;
    const permission = response.data.permission;
    if (permission === 'admin' || permission === 'write') return true;

    return false;
  }

  /**
   * Save (i.e. create or update) a document.
   * See {@link https://octokit.github.io/rest.js/v18#repos-create-or-update-file-contents}
   * @param {String} ownerUsername The owner
   * @param {String} repoName The repo
   * @param {String} path The path
   * @param {String} branch The branch
   * @param {String} message The commit message
   * @returns {Promise}
   */
  async createFolder({
    branch,
    message,
    ownerUsername: owner,
    path,
    repoName: repo,
  }: Types.SaveDocument) {
    if (!repo || !owner) return null;

    const filename = '.gitkeep';
    path = `${path}/${filename}`;

    const response = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: this.encodeContent(''),
      branch,
    });

    return response as any;
  }

  /**
   * Save (i.e. create or update) a document.
   * See {@link https://octokit.github.io/rest.js/v18#repos-create-or-update-file-contents}
   * @param {String} ownerUsername The owner
   * @param {String} repoName The repo
   * @param {String} path The path
   * @param {String} content The content
   * @param {String} branch The branch
   * @param {String} message The commit message
   * @param {String} [sha] The SHA
   * @returns {Promise}
   */
  async saveDocument(params: Types.SaveDocument) {
    const { branch, content, message, ownerUsername: owner, path, repoName: repo, hash } = params;

    if (!repo || !owner) return null;

    const response = await this.octokit.rest.repos
      .createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: this.encodeContent(content),
        branch,
        sha: hash,
      })
      .catch((error) => {
        if (error.message.includes('does not match')) {
          return { type: 'warning', status: 409, message: 'conflict' } as Types.ProviderError;
        }
        return null;
      });

    if (!response) return null;
    if (isErrorMessage(response)) return response;

    const updatedResource = { ...params, hash: response.data.content?.sha };
    return updatedResource;
  }

  // private async getLatestFileSHA({ owner, repo, path, branch }: IGetLatestFileSHA) {
  //   const response = await this.octokit
  //     .request({
  //       method: 'POST',
  //       url: '/graphql',
  //       query: `{
  //         repository(owner: "${owner}", name: "${repo}") {
  //           object(expression: "${branch}:${path}") {
  //             ... on Blob {
  //               oid
  //             }
  //           }
  //         }
  //       }`,
  //     })
  //     .catch(() => null);

  //   if (!response) return null;

  //   const {
  //     data: {
  //       data: {
  //         repository: { object: result },
  //       },
  //     },
  //   } = response;

  //   const hash = result ? result.oid : null;
  //   return hash;
  // }

  /**
   * Create a fork for the authenticated user.
   * See {@link https://octokit.github.io/rest.js/v18#repos-create-fork}
   * @param {String} ownerUsername The owner username
   * @param {String} repoName The repo name
   * @param {String} orgName The organization name
   * @returns {Promise}
   */
  async createFork({ ownerUsername, repoName, orgName }: Types.CreateFork) {
    if (!ownerUsername || !repoName) throw new Error('owner and repository are missing'); //return null;

    const response = await this.octokit.repos
      .createFork({ owner: ownerUsername, repo: repoName, organization: orgName })
      .catch((error) => {
        throw new Error(error);
      });

    const fork = response.data as unknown as T.Repository;
    return fork;
  }

  /**
   * Get single repository branch
   * See {@link https://octokit.github.io/rest.js/v18#repos-get-branch}
   * @param {String} branch The branch
   * @param {String} ownerUsername The owner
   * @param {String} repoName The repository
   * @returns {Promise}
   */
  async getBranch({ branch, ownerUsername, repoName }: Types.GetBranch) {
    if (!ownerUsername || !repoName) return null;
    const response = await this.octokit.rest.repos
      .getBranch({ owner: ownerUsername, repo: repoName, branch })
      .catch(() => null);

    if (!response) return null;
    return response.data;
  }

  /**
   * Check if branch exists
   * @param {String} branch The branch
   * @param {String} ownerUsername The owner
   * @param {String} repoName The repository
   * @returns {Promise<boolean>}
   */
  async checkForBranch({ branch, ownerUsername, repoName }: Types.GetBranch) {
    const response = await this.getBranch({ branch, ownerUsername, repoName });
    if (!response) return false;
    return true;
  }

  /**
   * Create new branch in the repository.
   * See {@link https://octokit.github.io/rest.js/v18#repos-create-fork}
   * @param {String} branchOrigin The branch origin
   * @param {String} branchTarget The new branch
   * @param {String} repoName The repo
   * @param {String} ownerUsername The owner username
   * @returns {Promise}
   */
  async createBranch({ ownerUsername, repoName, branchOrigin, branchTarget }: Types.CreateBranch) {
    if (!repoName || !ownerUsername) return null;

    const originBranch = await this.getBranch({
      ownerUsername,
      repoName,
      branch: branchOrigin,
    });

    if (!originBranch) return null;

    const response = await this.octokit.rest.git
      .createRef({
        owner: ownerUsername,
        repo: repoName,
        ref: `refs/heads/${branchTarget}`,
        sha: originBranch.commit.sha,
      })
      .catch(() => null);

    if (!response) return null;

    return response.data;
  }

  /**
   * Check for open pull requests
   * See {@link https://octokit.github.io/rest.js/v18#search-issues-and-pull-requests}
   * @param {String} branch The branch origin
   * @param {String} ownerUsername The onwer username
   * @param {String} repoName The repo
   * @param {String} title The title of the pull request
   * @returns {Promise}
   */
  private async checkForPullRequest({ ownerUsername, repoName, title }: CheckForPullRequest) {
    const query = `state:open type:pr repo:${ownerUsername}/${repoName} ${title} in:title`;

    const result = await this.octokit.rest.search.issuesAndPullRequests({ q: query });
    return result.data.total_count > 0;
  }

  /**
   * Save (i.e. create) a document as a pull request.
   * See {@link https://octokit.github.io/rest.js/v18#pulls-create}
   * @param {String} branchOrigin The branch origin
   * @param {String} branchTarget he branch Head
   * @param {String} ownerUsername The onwer username
   * @param {String} repository The repository
   * @param {String} title The title of the pull request
   * @returns {Promise<Types.CreatePrResponse>}
   */
  async createPullRequest({
    branchOrigin,
    branchHead,
    ownerUsername,
    origin,
    title,
  }: Types.CreatePrParams) {
    // there can be only one PR per branch */
    const doesPullRequestExist = await this.checkForPullRequest({
      branch: branchHead,
      ownerUsername,
      repoName: origin.name,
      title,
    });

    if (doesPullRequestExist) return 'exists';

    const pullRequest = await this.octokit.rest.pulls
      .create({
        base: branchOrigin,
        head: branchHead,
        owner: ownerUsername,
        repo: origin.name,
        title,
      })
      .catch(() => null);

    if (!pullRequest) return null;

    return 'created';
  }

  /**
   * Create a pull request from a fork.
   * See {@link https://octokit.github.io/rest.js/v18#pulls-create}
   * @param {String} fork The forked repository
   * @param {String} origin the origin repository
   * @param {String} title The title of the pull request
   * @returns {Promise<Types.CreatePrResponse>}
   */
  async createPullRequestFromFork({ fork, origin, title }: Types.CreatePrFromForkProps) {
    const base = origin.default_branch;
    const head = `${fork.owner.username}:${fork.default_branch}`;

    // there can be only one PR per branch */
    const doesPullRequestExist = await this.checkForPullRequest({
      branch: head,
      ownerUsername: origin.owner.username,
      repoName: origin.name,
      title,
    });

    if (doesPullRequestExist) return 'exists';

    const pullRequest = await this.octokit.rest.pulls
      .create({ owner: origin.owner.username, repo: origin.name, title, head, base })
      .catch(() => null);

    if (!pullRequest) return null;

    return 'created';
  }
}
