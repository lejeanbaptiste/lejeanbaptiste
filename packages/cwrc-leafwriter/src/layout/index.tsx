import { Stack } from '@mui/material';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { BottomBar } from '../components';
import { useAppState } from '../overmind';
import { LateralBar } from './LateralBar';
import { Main } from './Main';
import { ResizeHandle } from './ResizeHandle';
import { Section } from './Section';
import { AutoTaggingReviewPane } from './AutoTaggingReviewPane';
import { DisambiguationReviewPane } from './DisambiguationReviewPane';
import { TranslationPane } from './TranslationPane';

//* DOCUMENTATION
//* https://github.com/bvaughn/react-resizable-panels/tree/main/packages/react-resizable-panels
//* https://react-resizable-panels.vercel.app/examples/imperative-api

export const Layout = () => {
  const { active: translationActive } = useAppState().ui.translationMode;
  const { active: autoTaggingActive } = useAppState().ui.autoTaggingReview ?? { active: false };
  const { active: disambiguationActive } = useAppState().ui.disambiguationReview ?? { active: false };

  return (
    <Stack>
      <Stack direction="row" height="90vh">
        <LateralBar side="Left" />
        <PanelGroup direction="horizontal">
          <Section collapsible={true} side="left" />
          <ResizeHandle />
          <Main />
          {translationActive && (
            <>
              <ResizeHandle />
              <Panel id="translation" order={2} defaultSize={35} minSize={20}>
                <TranslationPane />
              </Panel>
            </>
          )}
          {autoTaggingActive && (
            <>
              <ResizeHandle />
              <Panel id="auto-tagging" order={3} defaultSize={38} minSize={24}>
                <AutoTaggingReviewPane />
              </Panel>
            </>
          )}
          {disambiguationActive && (
            <>
              <ResizeHandle />
              <Panel id="disambiguation" order={4} defaultSize={38} minSize={24}>
                <DisambiguationReviewPane />
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
