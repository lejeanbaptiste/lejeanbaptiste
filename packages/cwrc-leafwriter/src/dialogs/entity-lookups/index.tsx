import { Dialog } from '@mui/material';
import { getDefaultStore, Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { authorityServicesAtom, entityLookupDialogAtom } from '../../jotai/entity-lookup';
import { EntityLookupDialogProps } from '../../types';
import { Footer } from './footer';
import { Header } from './header';
import { Main } from './main';
import { QueryField } from './query-field';
import {
  authoritiesAtom,
  entityTypeAtom,
  isUserAuthenticatedAtom,
  lookupTypeAtom,
  onCloseAtom,
  queryAtom,
  resetLookupAtom,
} from './store';
import { useEntityLookup } from './useEntityLookup';

const defaultStore = getDefaultStore();

export const EntityLookupDialog = () => {
  const props = useAtomValue(entityLookupDialogAtom);
  return (
    <Dialog aria-labelledby="entity-lookup-title" fullWidth maxWidth="sm" open={!!props}>
      {!!props && (
        <Provider>
          <Wrapper
            isUserAuthenticated={props.isUserAuthenticated}
            onClose={props.onClose}
            query={props.query}
            type={props.type}
          >
            <Header />
            <QueryField />
            <Main />
            <Footer />
          </Wrapper>
        </Provider>
      )}
    </Dialog>
  );
};

export const Wrapper = ({
  children,
  isUserAuthenticated,
  onClose,
  query: initialQuery,
  type,
}: EntityLookupDialogProps & React.PropsWithChildren) => {
  const authorityServices = defaultStore.get(authorityServicesAtom);

  const setAuthorities = useSetAtom(authoritiesAtom);
  const setEntityType = useSetAtom(entityTypeAtom);
  const setIsUserAuthenticated = useSetAtom(isUserAuthenticatedAtom);
  const lookupType = useAtomValue(lookupTypeAtom);
  const [query, setQuery] = useAtom(queryAtom);
  const resetLookup = useSetAtom(resetLookupAtom);
  const setOnClose = useSetAtom(onCloseAtom);

  const { search } = useEntityLookup();

  useEffect(() => {
    const authorities = Array.from(authorityServices.values())
      .filter((auth) => !auth.disabled && auth.entities[type] === true)
      .toSorted((authA, authB) => (authA.priority ?? Infinity) - (authB.priority ?? Infinity));

    setAuthorities(authorities);
    setQuery(initialQuery);
    setEntityType(type);
    setIsUserAuthenticated(isUserAuthenticated);
    setOnClose(() => onClose);

    return () => resetLookup();
  }, []);

  useEffect(() => {
    query !== '' && search({ query, type: lookupType });
  }, [lookupType]);

  return <>{children}</>;
};
