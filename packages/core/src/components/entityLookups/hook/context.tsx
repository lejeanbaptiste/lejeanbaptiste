// import Entity from '@src/js-old/entities/Entity';
// import React, { createContext, ReactNode, useReducer, useContext } from 'react';
// import { useAppState } from '../../../overmind';
// import services from '../services';
// import { Authority, EntityLink, EntryLink, IResult, LookupsEntityType } from '../types';

// type LookupSearchProviderProps = { children: ReactNode };

// export type State = {
//   manualInput?: string;
//   results?: Map<Authority, IResult[]>;
//   selected?: EntryLink;
//   query: string;
//   type: LookupsEntityType;
// };

// interface Actions {
//   initiate: (entry: Entity) => void;
//   isUriValid: (value: string) => void;
//   processSelected: () => EntityLink | void;
//   reset: () => void;
//   search: (query: string) => Promise<Map<Authority, IResult[]> | void>;
//   setManualInput: (value: string) => void;
//   setQuery: (value: string) => void;
//   setSelected: (link?: EntryLink) => void;
//   setType: (type: LookupsEntityType) => void;
// }

// export const LookupSearchStateContext = createContext<{ state: State; actions: Actions } | undefined>(
//   undefined
// );

// const LookupSearchProvider = ({ children }: LookupSearchProviderProps) => {
//   const { lookups } = useAppState().editor;

//   // NOTE: you *might* need to memoize this value
//   // Learn more in http://kcd.im/optimize-context

//   const state: State = {
//     query: '',
//     type: 'rs',
//   };

//   const actions: Actions = {
//     initiate: (entry: Entity) => {
//       if (entry) {
//         const query = entry.getContent()?.trim() ?? '';
//         state.query = query;
//       } else {
//         const currentBookmark = window.writer?.editor?.currentBookmark;
//         if (!currentBookmark) return;
  
//         if ('rng' in currentBookmark) {
//           let query = currentBookmark.rng.toString();
//           query = query.trim().replace(/\s+/g, ' '); // remove excess whitespace
//           state.query = query;
//         }
//       }
//     },
//     isUriValid: (value: string) => {
//       const urlRegex =
//         /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i;
//       const isValid = urlRegex.test(value);
//       return isValid;
//     },
//     processSelected: () => {
//       let link: EntityLink | undefined;

//       if (state.selected) {
//         const { id, name, repository, uri } = state.selected;
//         link = {
//           id,
//           name,
//           properties: { lemma: name, uri },
//           query: state.query,
//           repository,
//           type: state.type,
//           uri,
//         };
//       }

//       if (state.manualInput && isUriValid(state.manualInput)) {
//         link = {
//           id: state.manualInput,
//           name: state.query,
//           properties: { lemma: state.query, uri: state.manualInput },
//           query: state.query,
//           repository: 'custom',
//           type: state.type,
//           uri: state.manualInput,
//         };
//       }

//       if (!link) return;
//     },
//     reset: () => {
//       state.manualInput = '';
//       state.query = '';
//       state.results = undefined;
//       state.selected = undefined;
//       state.type = 'rs';
//     },
//     search: async (query: string) => {
//       if (!state.type) return;

//       const type = state.type;

//       const authorities: Set<Authority> = new Set();

//       lookups.services.forEach((service, autority) => {
//         if (service.entities.has(type)) authorities.add(autority);
//       });

//       const results = new Map(
//         await Promise.all(
//           [...authorities].map(async (authority): Promise<[Authority, IResult[]]> => {
//             const response = await services[authority].find(query, type);
//             return [authority, response];
//           })
//         )
//       );

//       state.results = results;
//       return results;
//     },
//     setManualInput: (value: string) => {
//       state.manualInput = value;
//     },
//     setQuery: (value: string) => {
//       state.query = value;
//     },
//     setSelected: (link?: EntryLink) => {
//       state.selected = link ?? undefined;
//     },
//     setType: (type: LookupsEntityType) => {
//       state.type = type;
//     },
//   };

//   const value = { state, actions };

//   return (
//     <LookupSearchStateContext.Provider value={value}>{children}</LookupSearchStateContext.Provider>
//   );
// };

// const useLookup = () => {
//   const context = useContext(LookupSearchStateContext);
//   if (context === undefined) {
//     throw new Error('useCount must be used within a CountProvider');
//   }
//   return context;
// };

// export { LookupSearchProvider, useLookup };
