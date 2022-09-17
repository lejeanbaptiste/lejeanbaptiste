import { type Leafwriter } from '@cwrc/leafwriter';

type State = {
  isDirty: boolean;
  leafWriter?: Leafwriter;
};

export const state: State = {
  isDirty: false,
};
