import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import { type AuthorityServices, type EntityLookupDialogProps } from '../../types';

export const entityLookupDialogAtom = atomWithReset<EntityLookupDialogProps | null>(null);
entityLookupDialogAtom.debugLabel = 'entityLookupDialog.Atom';

export const authorityServicesAtom = atom<AuthorityServices>(new Map());
authorityServicesAtom.debugLabel = 'authorityServices.Atom';
