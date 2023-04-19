import { createOvermindMock, IContext } from 'overmind';
import { config } from '../../src/overmind';

export let overmind: IContext<typeof config>;

export const resetOvermind = () => {
  overmind = createOvermindMock(config, (state) => {
    state.ui = { dialogBar: [] };

    state.common = {
      alertDialog: { open: false },
      allowAllFileTypes: false,
      allowedMimeTypes: ['application/xml'],
      dialogType: 'load',
      messageDialog: { open: false },
      showInvisibleFiles: false,
      source: 'local',
      sources: [],
    };

    state.cloud = {
      collectionSource: 'owner',
      commitMessage: 'update',
      defaultCommitMessage: 'update',
      isFetching: false,
      isLoading: false,
      isSaving: false,
      providers: [],
      repositoryContent: {},
    };
  });
};
