import type {
  CollectionSource,
  DocumentDetails,
  Organization,
  PublicRepository,
  Repository,
} from './types';

export type ProviderAuth = {
  access_token: string;
  name: string;
};

export interface UserDetailParams {
  type?: string;
  user: string;
}

export interface PaginatorParams {
  nextPage?: string;
  per_page?: number;
}

export interface ReposParams extends PaginatorParams {
  collectionSource?: CollectionSource;
}

export interface ReposForUserParams extends ReposParams {
  username: string;
}

export interface RepoParams {
  checkForkStatus?: boolean;
  repoId: string;
  repoName: string;
  username: string;
}

export interface ReposForOrgsParams extends PaginatorParams {
  orgId?: string;
  orgUsername?: string;
}

export interface RepoBranchesParams extends PaginatorParams {
  repoName: string;
  repoId: string | number;
  owner?: string;
  search?: string;
}

export interface RepoContentParams {
  branch: string;
  ownerUsername?: string;
  path?: string;
  repoId?: string;
  repoName?: string;
}

export interface SearchUserParams {
  query: string;
}

export interface SearchBlobsParams {
  extension?: string;
  owner: string;
  query: string;
  repoId?: string;
}

export interface CreateRepoParams {
  description?: string;
  isPrivate?: boolean;
  name: string;
  orgId?: string;
  orgName?: string;
  userId?: string;
}

export interface CheckOrgMemberWrittenPermission {
  orgId?: string;
  orgName?: string;
  userId?: string;
  username?: string;
}

export interface CheckRepoUserWrittenPermission {
  ownerId?: string;
  ownerUsername?: string;
  repoId?: string;
  repoName?: string;
  userId?: string;
  username?: string;
}

export interface GetOrganization {
  orgId?: string;
  orgName?: string;
}

export interface ISaveDocument {
  branch: string;
  content: string;
  hash?: string;
  message: string;
  ownerUsername?: string;
  path: string;
  repoId?: string;
  repoName?: string;
}

export interface ICreateFork {
  orgName?: string;
  ownerUsername: string;
  repoId: string;
  repoName: string;
}

export interface ICreateBranch {
  branchOrigin: string;
  branchTarget: string;
  ownerUsername?: string;
  repoId?: string;
  repoName?: string;
}

export interface IGetBranch {
  branch: string;
  ownerUsername?: string;
  repoId?: string;
  repoName?: string;
}

export interface ICreatePrParams {
  branchOrigin: string;
  branchHead: string;
  origin: Repository;
  ownerUsername: string;
  title: string;
}

export interface ICreatePrFromForkParams {
  fork: Repository;
  origin: Repository;
  title: string;
}

export type CreatePrResponse = 'created' | 'exists' | null;

export default interface Provider {
  readonly name: string;
  userId: string;
  username: string;

  checkForBranch: (params: IGetBranch) => Promise<boolean>;
  checkOrgMemberWritenPermission: (params: CheckOrgMemberWrittenPermission) => Promise<boolean>;
  checkRepoUserWritenPermission: (params: CheckRepoUserWrittenPermission) => Promise<boolean>;
  createBranch: (params: ICreateBranch) => Promise<any>;
  createFolder: (params: ISaveDocument) => Promise<any>;
  createFork: (params: ICreateFork) => Promise<Repository>;
  createPullRequest: (params: ICreatePrParams) => Promise<CreatePrResponse>;
  createPullRequestFromFork: (params: ICreatePrFromForkParams) => Promise<CreatePrResponse>;
  createRepo: (params: CreateRepoParams) => Promise<Repository | null>;
  createRepoInOrg: (params: CreateRepoParams) => Promise<Repository | null>;
  getAuthenticatedUser(): Promise<any>;
  getBranch: (params: IGetBranch) => Promise<any>;
  getDetailsForUser(params: UserDetailParams): Promise<any>;
  getDocument: (params: RepoContentParams) => Promise<DocumentDetails | null>;
  getOrganization?: (params: GetOrganization) => Promise<Organization | null>;
  getOrganizationsForAuthenticatedUser(params: PaginatorParams): Promise<{
    collection: Organization[];
    nextPage: string | null;
  } | null>;
  getRepo: (params: RepoParams) => Promise<Repository>;
  getRepoBranches(params: RepoBranchesParams): Promise<any>;
  getRepoContent(params: RepoContentParams): Promise<any | null>;
  getRepoContentRecursively: (params: RepoContentParams) => Promise<any[] | null>;
  getReposForAuthenticatedUser(params: ReposParams): Promise<{
    collection: Repository[];
    nextPage: string | null;
  } | null>;
  getReposForOrganization(params: ReposForOrgsParams): Promise<{
    collection: Repository[];
    nextPage: string | null;
  } | null>;
  getReposForUser(params: ReposForUserParams): Promise<{
    collection: Repository[];
    nextPage: string | null;
  } | null>;
  saveDocument: (params: ISaveDocument) => Promise<any>;
  searchBlobs: (params: SearchBlobsParams) => Promise<any[]>;
  searchUsers: (query: string) => Promise<PublicRepository[]>;
}
