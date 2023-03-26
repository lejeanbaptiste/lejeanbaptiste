import { NodeDetail } from '@cwrc/leafwriter-validator';
import { atom } from 'jotai';

export const countElementsAtom = atom<number | null>(null);
export const nodeTypeAtom = atom<'text' | 'tag'>('tag');
export const showOnlyValidAtom = atom(true);
export const tagFullNameAtom = atom((get) => get(tagMetaAtom)?.fullName);
export const tagMetaAtom = atom<NodeDetail | null>(null);
export const tagNameAtom = atom<string | null>(null);
export const xpathAtom = atom<string | null>(null);
