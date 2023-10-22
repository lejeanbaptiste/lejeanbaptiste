import i18next from '../../i18n';
import type {
  CollectionSource,
  CollectionType,
  Content,
  Organization,
  Owner,
  Repository,
  SuportedProviders,
} from '../../types';

// * The following line is need for VSC extension i18n ally to work
// useTranslation('LWStorageService');

const { t } = i18next;

interface State {
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
}

export const state: State = {
  collectionSource: 'owner',
  commitMessage: t('cloud.settings.update', { ns: 'LWStorageService' }),
  defaultCommitMessage: t('cloud.settings.update', { ns: 'LWStorageService' }),
  isFetching: false,
  isLoading: false,
  isSaving: false,
  providers: [],
  repositoryContent: {},
};
