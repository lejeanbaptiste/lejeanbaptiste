import { Box } from '@mui/material';
import { LoadingMask } from '@src/components';
import { useLeafWriter } from '@src/hooks';
import { leafwriterAtom } from '@src/jotai';
import { useAppState } from '@src/overmind';
import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { useMenu } from './topbar';

export const Editor = () => {
  const { contentHasChanged, libLoaded, readonly, resource } = useAppState().editor;

  const divEl = useRef<HTMLDivElement>(null);

  const { initLeafWriter, loadLib } = useLeafWriter();
  const { onKeydownHandle } = useMenu();

  const [leafWriter, setLeafWriter] = useAtom(leafwriterAtom);

  useEffect(() => {
    window.addEventListener('keydown', onKeydownHandle);
    return () => {
      window.removeEventListener('keydown', onKeydownHandle);
      setLeafWriter(null);
    };
  }, []);

  useEffect(() => {
    if (divEl.current && !libLoaded) loadLib(divEl.current);
  }, [divEl.current]);

  useEffect(() => {
    if (leafWriter) initLeafWriter();
  }, [leafWriter?.id]);

  useEffect(() => {
    leafWriter?.setContentHasChanged(contentHasChanged);
  }, [contentHasChanged]);

  useEffect(() => {
    leafWriter?.setReadonly(readonly);
  }, [readonly]);

  return (
    <Box ref={divEl} id="leaf-writer-container" style={{ height: 'calc(100vh - 48px)' }}>
      {(!libLoaded || !resource) && <LoadingMask />}
    </Box>
  );
};
