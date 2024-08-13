import Leafwriter from '@cwrc/leafwriter';
import { atom } from 'jotai';
import { Subscription } from 'rxjs';

export const leafwriterAtom = atom<Leafwriter | null>(null);
leafwriterAtom.debugLabel = 'leafwriter.Atom';

export const leafWriterEventsAtom = atom<Subscription[]>([]);
leafWriterEventsAtom.debugLabel = 'leafWriterEvents.Atom';

export const tapDocumentTimerAtom = atom<NodeJS.Timeout | null>(null);
tapDocumentTimerAtom.debugLabel = 'tapDocumentTimer.Atom';
