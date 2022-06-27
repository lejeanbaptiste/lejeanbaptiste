import Leafwriter from '@cwrc/leafwriter';

type State = {
  leafWriter?: Leafwriter;
  isDirty: boolean;
};

export const state: State = {
  isDirty: false,
};
