import { Stack } from '@mui/material';
import { useAtomValue } from 'jotai';
import { authorityServicesAtom } from '../../../../jotai/entity-lookup';
import { Authority } from './Authority';

export const Authorities2 = () => {
  const authorityServices = useAtomValue(authorityServicesAtom);

  return (
    <Stack width="100%" py={1} spacing={2}>
      <Stack mt={1} spacing={1}>
        {[...authorityServices.values()].map((item) => (
          <Authority key={item.id} authorityService={item} />
        ))}
      </Stack>
    </Stack>
  );
};
