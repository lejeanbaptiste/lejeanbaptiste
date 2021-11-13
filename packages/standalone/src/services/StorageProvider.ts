import type { AffiliationType } from '@src/@types/types';
import type { IdentityProvider } from './IdentityProvider';

export interface GetUserDetailParams {
  user: string;
  type?: string;
}

export interface ParamsPaginator {
  nextPage?: string;
  per_page?: number;
}

export interface GetReposParams extends ParamsPaginator {
  affiliation?: AffiliationType;
}

export interface GetReposParamsForUser extends ParamsPaginator {
  username: string;
}

export interface GetRepoParams {
  username: string;
  repoName: string;
}

export interface ParamsGetReposForOrgs extends ParamsPaginator {
  id?: number | string;
  name?: string;
}

export interface GetRepoBranchesParams extends ParamsPaginator {
  repoName: string;
  repoId: string | number;
  owner?: string;
  search?: string;
}

export interface GetRepoContentParams {
  owner: string;
  path: string;
  branch: string;
  repoId: string;
  repoName: string;
}

export interface SearchBlobsParams {
  owner: string;
  query: string;
  repoId?: string;
}

export interface UserLite {
  avatar_url?: string;
  id: number;
  name: string;
  type: 'user' | 'organization';
  username: string;
}

export interface DocumentDetails {
  document: string;
  sha: string;
}

export interface StorageProvider extends IdentityProvider {
  getDetailsForUser(params: GetUserDetailParams): Promise<any>;
  getReposForAuthenticatedUser(params?: GetReposParams): any;
  getRepo: (params: GetRepoParams) => Promise<any | null>;
  getReposForUser(params?: GetReposParamsForUser): any;
  getRepoContent(params?: GetRepoContentParams): Promise<any | null>;
  getRepoContentRecursively: (params: GetRepoContentParams) => Promise<any[] | null>;
  getRepoBranches(params?: GetRepoBranchesParams): any;
  getOrganizationsForAuthenticatedUser(params?: ParamsPaginator): Promise<any>;
  getReposForOrganization(params?: ParamsGetReposForOrgs): Promise<any>;
  searchUsers: (query: string) => Promise<UserLite[]>;
  searchBlobs: (params: SearchBlobsParams) => Promise<any[]>;
  getDocument?: (params: GetRepoContentParams) => Promise<DocumentDetails>;
}
