import { Stack } from '@mui/material';
import { useAtomValue } from 'jotai';
import { authorityServicesAtom } from '../../../../jotai/entity-lookup';
import { Authority } from './authority';

export const Authorities = () => {
  const authorityServices = useAtomValue(authorityServicesAtom);

  return (
    <Stack width="100%" mt={1} py={1} gap={0.5}>
      {[...authorityServices.values()].map((service) => (
        <Authority key={service.id} authorityService={service} />
      ))}
    </Stack>
  );
};
