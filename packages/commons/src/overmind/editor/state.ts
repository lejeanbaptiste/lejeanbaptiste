import { type Leafwriter } from '@cwrc/leafwriter';

type State = {
  isDirty: boolean;
  leafWriter?: Leafwriter;
  libLoaded: boolean;
  isSaving: boolean;
};

export const state: State = {
  isDirty: false,
  libLoaded: false,
  isSaving: false,
};
