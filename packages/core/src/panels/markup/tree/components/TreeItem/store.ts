import { atom } from 'jotai';

const TIME_OUT_HOVER = 1200;
const TIME_OUT_HOVER_RESET = 2000;

let timer: NodeJS.Timeout;
const _detailsHoverTimeOutAtom = atom(TIME_OUT_HOVER);
export const detailsHoverTimeOutAtom = atom(
  (get) => get(_detailsHoverTimeOutAtom),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (get, set, value?) => {
    set(_detailsHoverTimeOutAtom, 0);
    clearTimeout(timer);
    timer = setTimeout(() => {
      set(_detailsHoverTimeOutAtom, TIME_OUT_HOVER);
    }, TIME_OUT_HOVER_RESET);
  }
);
