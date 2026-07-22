import { checkWellFormedness } from '../../utilities/checkWellFormedness';

/** Mirrored delete and auto-unwrap only run on well-formed XML with a matched pair. */
export const isPairedTagAutoDeleteAllowed = (content: string): boolean =>
  checkWellFormedness(content).valid;
