import { Stack } from '@mui/material';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { BottomBar } from '../components';
import { useAppState } from '../overmind';
import { LateralBar } from './LateralBar';
import { Main } from './Main';
import { ResizeHandle } from './ResizeHandle';
import { Section } from './Section';
import { TranslationPane } from './TranslationPane';

//* DOCUMENTATION
//* https://github.com/bvaughn/react-resizable-panels/tree/main/packages/react-resizable-panels
//* https://react-resizable-panels.vercel.app/examples/imperative-api

export const Layout = () => {
  const { active } = useAppState().ui.translationMode;

  return (
    <Stack>
      <Stack direction="row" height="90vh">
        <LateralBar side="Left" />
        <PanelGroup direction="horizontal">
          <Section collapsible={true} side="left" />
          <ResizeHandle />
          <Main />
          {active && (
            <>
              <ResizeHandle />
              <Panel id="translation" order={2} defaultSize={35} minSize={20}>
                <TranslationPane />
              </Panel>
            </>
          )}
          <ResizeHandle />
          <Section collapsible={true} side="right" />
        </PanelGroup>
        <LateralBar side="Right" />
      </Stack>
      <BottomBar />
    </Stack>
  );
};
