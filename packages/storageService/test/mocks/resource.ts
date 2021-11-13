import type { ProviderAuth } from '../../src/@types/Provider';
import { DocumentDetails, Organization, Repository, Resource, User } from '../../src/@types/types';

export const unsupportedProviderAuth: ProviderAuth = { name: 'google', access_token: '12345' };
export const githubAuth: ProviderAuth = { name: 'github', access_token: 'gho_vtkG' };
export const gitlabAuth: ProviderAuth = { name: 'gitlab', access_token: '1234' };

export const getProviderAuth = (provider = 'github'): ProviderAuth => {
  if (provider === 'github') return githubAuth;
  if (provider === 'gitlab') return gitlabAuth;
};

type GetResourceParams = {
  type?: string;
  provider?: string;
};

export const getResource = ({ type, provider = 'github' }: GetResourceParams): Resource => {
  if (!type) {
    return {
      provider,
      owner: provider === 'gitlab' ? '0102' : 'username',
      ownertype: 'user',
      repo: provider === 'gitlab' ? '4324' : 'some-repositotry',
      path: '',
      filename: 'carta.xml',
      content: 'test',
      hash: '111',
    };
  }

  if (type === 'empty') return {};
  if (type === 'owner_undefined') return { provider };
  if (type === 'ownertype_undefined') return { provider, owner: 'someusername' };
  if (type === 'repo_undefined') return { provider, owner: 'someuser', ownertype: 'user' };

  if (type === 'filename_undefined') {
    return { provider, owner: 'someuser', ownertype: 'user', repo: 'somerepositotry', path: '' };
  }

  if (type === 'repo_invalid') {
    return {
      provider,
      owner: 'someuser',
      ownertype: 'user',
      repo: 'invalid-repo',
      path: '',
      filename: 'carta.xml',
    };
  }

  if (type === 'document_not_found') {
    return {
      provider,
      owner: 'someuser',
      ownertype: 'user',
      repo: 'invalid-repo',
      path: '',
      filename: 'invalid_filename.xml',
    };
  }
};

export const authenticatedUser: User = {
  username: 'lucaju',
  email: 'lucaju@gmail.com',
  prefferedID: 'github',
  identities: [''],
};

export const repository: Repository = {
  name: 'Git-Writer-demos',
  id: '12345',
  default_branch: 'main',
  owner: { username: 'lucaju' },
  path: '',
};

export const repositories: Repository[] = [
  {
    name: 'repo1',
    id: '12345',
    default_branch: 'main',
    owner: { username: 'username' },
    path: '',
  },
  {
    name: 'repo2',
    id: '12346',
    default_branch: 'main',
    owner: { username: 'username' },
    path: '',
  },
];

export const repoContent = [
  {
    name: 'folder1',
    path: 'folder1',
    sha: '2343432523523',
    size: 0,
    type: 'folder',
  },
  {
    name: 'file1.xml',
    path: 'file1.xml',
    sha: '3548e193b649cfbe0f06ccf34ef7f6d0cd2c0777',
    size: 11602,
    type: 'file',
  },
  {
    name: 'file2.xml',
    path: 'file2.xml',
    sha: '3548e193b649cfbe0f06ccf34ef7f6d0cd2c0776',
    size: 21602,
    type: 'file',
  },
  {
    name: 'test',
    path: 'test',
    sha: '111',
    size: 21602,
    type: 'file',
  },
];

export const organizations: Organization[] = [
  {
    id: '1',
    name: 'organization 1',
    type: 'organization',
    username: 'org1',
  },
  {
    id: '2',
    name: 'organization 2',
    type: 'organization',
    username: 'org2',
  },
  {
    id: '3',
    name: 'organization 3',
    type: 'organization',
    username: 'org3',
  },
];

export const document: DocumentDetails = {
  content: 'test',
  hash: '111',
};

export const savedDocument = {
  branch: 'main',
  content: 'test updated',
  hash: 'new hash',
  message: 'update',
  path: '',
};

export const resultSearchBlob = [
  {
    name: 'languages.xml',
    type: 'file',
    owner: { id: 1254739, username: 'lucaju' },
    path: 'bin-debug/model/library',
    repository: { id: 8793505, name: 'CiteLens' },
    score: 1,
    text_matches: [
      {
        object_url:
          'https://api.github.com/repositories/8793505/contents/bin-debug/model/library/languages.xml?ref=35b68af1659f030c4770ad727d57a4a9b104a2e6',
        object_type: 'FileContent',
        property: 'content',
        fragment:
          '"/>\n  <language name="Galibi Carib" iso639-1=" " iso639-2="car"/>\n  <language name="Catalan; Valencian',
        matches: [{ text: 'car', indices: [59, 62] }],
      },
    ],
  },
  {
    name: 'lang.xml',
    type: 'folder',
    owner: { id: 1254739, username: 'lucaju' },
    path: 'Apps/CiteLens.app/Contents/Resources/model/library',
    repository: { id: 8793505, name: 'CiteLens' },
    score: 1,
    text_matches: [
      {
        object_url:
          'https://api.github.com/repositories/8793505/contents/Apps/CiteLens.app/Contents/Resources/model/library/languages.xml?ref=35b68af1659f030c4770ad727d57a4a9b104a2e6',
        object_type: 'FileContent',
        property: 'content',
        fragment:
          '"/>\n  <language name="Galibi Carib" iso639-1=" " iso639-2="car"/>\n  <language name="Catalan; Valencian',
        matches: [{ text: 'car', indices: [59, 62] }],
      },
    ],
  },
  {
    name: 'language.xml',
    type: 'file',
    owner: { id: 1254739, username: 'lucaju' },
    path: 'src/model/library',
    repository: { id: 8793505, name: 'CiteLens' },
    score: 1,
    text_matches: [
      {
        object_url:
          'https://api.github.com/repositories/8793505/contents/src/model/library/languages.xml?ref=35b68af1659f030c4770ad727d57a4a9b104a2e6',
        object_type: 'FileContent',
        property: 'content',
        fragment:
          '"/>\n  <language name="Galibi Carib" iso639-1=" " iso639-2="car"/>\n  <language name="Catalan; Valencian',
        matches: [{ text: 'car', indices: [59, 62] }],
      },
    ],
  },
];

export const searchUsersResult = [
  {
    avatar_url: 'https://avatars.githubusercontent.com/u/1643728?v=4',
    id: 1643728,
    name: '',
    type: 'user',
    username: 'anto',
  },
  {
    avatar_url: 'https://avatars.githubusercontent.com/u/4977112?v=4',
    id: 4977112,
    name: 'Anto',
    type: 'org',
    username: 'antograssiot',
  },
];
