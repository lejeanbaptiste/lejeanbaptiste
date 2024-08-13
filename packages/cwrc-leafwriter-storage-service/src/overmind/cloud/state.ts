import type {
  CollectionSource,
  CollectionType,
  Content,
  Organization,
  Owner,
  Repository,
  SuportedProviders,
} from '@src/types';
import i18n from '../../i18n';

// * The following line is need for VSC extension i18n ally to work
// useTranslation();

const { t } = i18n;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
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
  commitMessage: t('SS.cloud.settings.update'),
  defaultCommitMessage: t('SS.cloud.settings.update'),
  isFetching: false,
  isLoading: false,
  isSaving: false,
  providers: [],
  repositoryContent: {},
};
