import { listTransformations } from '@src/services/leaf-te';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import useSWR from 'swr';
import { conversionTypesAtom, dialogActionAtom, selectedTypeAtom } from '../store';
import { log } from '@src/utilities';

export const useConversionAvailability = () => {
  const dialogAction = useAtomValue(dialogActionAtom);
  const setConversionTypes = useSetAtom(conversionTypesAtom);
  const setSelectedType = useSetAtom(selectedTypeAtom);

  const params = dialogAction === 'import' ? { to: 'TEI' } : { from: 'TEI' };

  const { data, error, isLoading } = useSWR<string[], Error>(params, listTransformations, {
    revalidateOnFocus: false, //only because this resource does not change constantlu
  });

  useEffect(() => {
    if (error) log.error(error.message);
    if (!data) return;
    setConversionTypes(data);
    setSelectedType(data.at(0));
  }, [isLoading]);

  return {
    data,
    error,
    isLoading,
  };
};
