import { atom } from 'jotai';
import type { XMLValidity } from './hooks/useValidation';
import { EditSourceDialogProps } from '../type';

export const originalContentAtom = atom<string>('');
originalContentAtom.debugLabel = 'originalContent.Atom';

export const currentContentAtom = atom<string>('');
currentContentAtom.debugLabel = 'currentContent.Atom';

export const xmlValidityAtom = atom<XMLValidity>({ valid: true });
xmlValidityAtom.debugLabel = 'xmlValidity.Atom';

export const contentTypeAtom = atom<EditSourceDialogProps['type']>('content');
contentTypeAtom.debugLabel = 'contentType.Atom';
