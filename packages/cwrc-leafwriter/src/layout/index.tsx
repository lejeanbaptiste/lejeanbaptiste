import { Stack } from '@mui/material';
import { PanelGroup } from 'react-resizable-panels';
import { BottomBar } from '../components';
import { LateralBar } from './LateralBar';
import { Main } from './Main';
import { ResizeHandle } from './ResizeHandle';
import { Section } from './Section';

//* DOCUMENTATION
//* https://github.com/bvaughn/react-resizable-panels/tree/main/packages/react-resizable-panels
//* https://react-resizable-panels.vercel.app/examples/imperative-api

export const Layout = () => {
  return (
    <Stack>
      <Stack direction="row" height="90vh">
        <LateralBar side="Left" />
        <PanelGroup direction="horizontal">
          <Section collapsible={true} side="left" />
          <ResizeHandle />
          <Main />
          <ResizeHandle />
          <Section collapsible={true} side="right" />
        </PanelGroup>
        <LateralBar side="Right" />
      </Stack>
      <BottomBar />
    </Stack>
  );
};
