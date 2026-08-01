import { Dialog } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDefaultStore, Provider, useAtomValue, useSetAtom } from 'jotai';
import { db } from '../../db';
import { authorityServicesAtom, entityLookupDialogAtom } from '../../jotai/entity-lookup';
import { isOwnDatabaseService } from '../../services/own-database-authorities';
import { AuthorityService, EntityLookupDialogProps } from '../../types';
import { Footer } from './footer';
import { Header } from './header';
import { allowedOwnDatabaseServiceIds, projectSyncsToCentral } from './lookupMode';
import { MergedLookupMain } from './mergedLookupMain';
import { QueryField } from './query-field';
import { ResolutionPanel } from './resolution-panel';
import {
  authoritiesAtom,
  attachToEntityIdAtom,
  entityTypeAtom,
  isUserAuthenticatedAtom,
  onCloseAtom,
  queryAtom,
} from './store';

export { allowedOwnDatabaseServiceIds, projectSyncsToCentral } from './lookupMode';

const defaultStore = getDefaultStore();

export const EntityLookupDialog = () => {
  const props = useAtomValue(entityLookupDialogAtom);
  return (
    <Dialog
      aria-labelledby="entity-lookup-title"
      fullWidth
      maxWidth="sm"
      open={!!props}
      PaperProps={{ sx: { maxHeight: 'min(70vh, 520px)' } }}
    >
      {!!props && (
        <Provider>
          <Wrapper
            isUserAuthenticated={props.isUserAuthenticated}
            onClose={props.onClose}
            query={props.query}
            type={props.type}
            attachToEntityId={props.attachToEntityId}
          >
            <Header />
            <QueryField />
            <MergedLookupMain />
            <ResolutionPanel />
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
  attachToEntityId,
}: EntityLookupDialogProps & React.PropsWithChildren) => {
  const authorityServices = defaultStore.get(authorityServicesAtom);

  const setAuthorities = useSetAtom(authoritiesAtom);
  const setEntityType = useSetAtom(entityTypeAtom);
  const setIsUserAuthenticated = useSetAtom(isUserAuthenticatedAtom);
  const setAttachToEntityId = useSetAtom(attachToEntityIdAtom);
  const setQuery = useSetAtom(queryAtom);
  const setOnClose = useSetAtom(onCloseAtom);

  useLiveQuery(async () => {
    const prefs = await db.lookupServicePreferences.where({ entityType: type }).sortBy('priority');
    const allowedOwn = allowedOwnDatabaseServiceIds(attachToEntityId, projectSyncsToCentral());

    const authorities: AuthorityService[] = [];
    prefs.forEach((pref) => {
      if (isOwnDatabaseService(pref.authorityId) && !allowedOwn.has(pref.authorityId)) return;
      // PEDB/CEDB cannot be disabled from settings when they are allowed here.
      if (pref.disabled && !isOwnDatabaseService(pref.authorityId)) return;
      const authority = authorityServices.get(pref.authorityId);
      if (authority) authorities.push(authority);
    });

    setAuthorities(authorities);
    setQuery(initialQuery);
    setEntityType(type);
    setIsUserAuthenticated(isUserAuthenticated);
    setAttachToEntityId(attachToEntityId ?? null);
    setOnClose(() => onClose);

    return authorities;
  }, [type, attachToEntityId]);

  return children;
};
