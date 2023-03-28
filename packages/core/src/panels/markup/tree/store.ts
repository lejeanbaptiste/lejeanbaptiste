import { UniqueIdentifier } from '@dnd-kit/core';
import { atom } from 'jotai';
import { TreeItems } from './types';

export const allowDndAtom = atom(false);
export const displayTextNodesAtom = atom(false);

export const activeIdAtom = atom<UniqueIdentifier | null>(null);
export const expandedItemsAtom = atom<UniqueIdentifier[]>([]);
export const itemsAtom = atom<TreeItems>([]);
export const nodeChangedAtom = atom<UniqueIdentifier | null>(null);
export const selectedItemsAtom = atom<UniqueIdentifier[]>([]);
