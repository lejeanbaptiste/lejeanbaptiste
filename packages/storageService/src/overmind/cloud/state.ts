import type {
  CollectionSource,
  CollectionType,
  Content,
  Organization,
  Owner,
  PublicRepository,
  Repository,
  SuportedProviders,
} from '../../types';
import i18next from '../../i18n';

type State = {
  collectionSource: CollectionSource;
  collectionType?: CollectionType;
  commitMessage: string;
  defaultCommitMessage: string;
  isFetching: boolean;
  isLoading: boolean;
  isSaving: boolean;
  name?: SuportedProviders;
  organizations?: {
    collection: Organization[];
    hasMore?: boolean;
    nextPage?: string;
  };
  owner?: Owner | Organization;
  providers: SuportedProviders[];
  publicRepositories?: PublicRepository;
  repositories?: {
    collection: Repository[];
    hasMore?: boolean;
    nextPage?: string;
  };
  repository?: Repository;
  repositoryContent: {
    path?: string[];
    tree?: Content[];
  };
  user?: Owner;
};

export const state: State = {
  collectionSource: 'owner',
  commitMessage: i18next.t('cloud:settings:update'),
  defaultCommitMessage: i18next.t('cloud:settings:update'),
  isFetching: false,
  isLoading: false,
  isSaving: false,
  providers: [],
  repositoryContent: {},
};
