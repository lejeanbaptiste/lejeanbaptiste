import type { FileDetail, Resource } from '@src/types';
import { atom, createStore } from 'jotai';
import type { DialogTye } from './';

export const ImportExportStore = createStore()

export const dialogActionAtom = atom<DialogTye>('import');
export const conversionTypesAtom = atom<string[]>([]);
export const selectedTypeAtom = atom<string | undefined>(undefined);

export const fileDetailAtom = atom<FileDetail | undefined>(undefined);
export const isProcessingAtom = atom(false);
export const resourceAtom = atom<Resource | undefined>(undefined);

export const cancelActionAtom = atom(
  null, // it's a convention to pass `null` for the first argument
  (_get, set) => {
    set(fileDetailAtom, undefined);
    set(isProcessingAtom, false);
    set(resourceAtom, undefined);

    ImportExportStore.set(fileDetailAtom, undefined);
    ImportExportStore.set(isProcessingAtom, false);
    ImportExportStore.set(resourceAtom, undefined);
  }
);


ImportExportStore.set(dialogActionAtom, 'import');
ImportExportStore.set(conversionTypesAtom, []);
ImportExportStore.set(selectedTypeAtom, undefined);

ImportExportStore.set(fileDetailAtom, undefined);
ImportExportStore.set(isProcessingAtom, false);
ImportExportStore.set(resourceAtom, undefined);

export const cancelAction = () => {
  ImportExportStore.set(fileDetailAtom, undefined);
  ImportExportStore.set(isProcessingAtom, false);
  ImportExportStore.set(resourceAtom, undefined);
}