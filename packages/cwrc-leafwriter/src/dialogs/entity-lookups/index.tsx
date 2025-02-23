import { Dialog } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDefaultStore, Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { db } from '../../db';
import { authorityServicesAtom, entityLookupDialogAtom } from '../../jotai/entity-lookup';
import { AuthorityService, EntityLookupDialogProps } from '../../types';
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
  const setOnClose = useSetAtom(onCloseAtom);

  const { search } = useEntityLookup();

  const authorities = useLiveQuery(async () => {
    const prefs = await db.lookupServicePreferences.where({ entityType: type }).sortBy('priority');

    const authorities: AuthorityService[] = [];
    prefs.forEach((pref) => {
      if (pref.disabled) return;
      const authority = authorityServices.get(pref.authorityId);
      if (authority) authorities.push(authority);
    });

    setAuthorities(authorities);
    setQuery(initialQuery);
    setEntityType(type);
    setIsUserAuthenticated(isUserAuthenticated);
    setOnClose(() => onClose);

    return authorities;
  }, [type]);

  useEffect(() => {
    query !== '' && search({ query, type: lookupType });
  }, [authorities]);

  return <>{children}</>;
};
