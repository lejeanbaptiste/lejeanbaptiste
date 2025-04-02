import { Stack } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtomValue } from 'jotai';
import { db } from '../../../../db';
import { authorityServicesAtom } from '../../../../jotai/entity-lookup';
import { Authority } from './authority';

export const Authorities = () => {
  const authorityServices = useAtomValue(authorityServicesAtom);

  const authorityIds = useLiveQuery(async () => {
    const preferences = await db.lookupServicePreferences.toArray();
    const uniqueAuthorities = new Set(preferences.map((preference) => preference.authorityId));
    return Array.from(uniqueAuthorities);
  });

  return (
    <Stack width="100%" mt={1} py={1} gap={0.5}>
      {authorityIds?.map((id) => {
        const service = authorityServices.get(id);
        if (!service) return null;
        return <Authority key={service.id} authorityService={service} />;
      })}
    </Stack>
  );
};
