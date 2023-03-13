import { Box } from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import { Toggler } from '../components';

export const StructurePanel = () => {
  const { structurePanel } = useAppState().ui;
  const {
    allowStructurePanelMultiselection,
    allowTagDragAndDrop,
    showTextNodes,
    showTextNodesContent,
  } = useActions().ui;
  const { t } = useTranslation();

  const itemVariants: Variants = {
    hidden: { height: 0, opacity: 0 },
    show: { height: 'auto', opacity: 1 },
  };

  return (
    <Box component={motion.div} layout="position">
      <Toggler
        description={`${t('Text Nodes must be displayed for better accuracy').toString()} (${t(
          'experimental'
        )})`}
        disabled={!structurePanel.showTextNodes}
        icon="dragAndDrop"
        onChange={allowTagDragAndDrop}
        title={t('Allow drag and drop')}
        value={structurePanel.allowDragAndDrop}
      />
      <Toggler
        icon="tagMultiSelection"
        onChange={allowStructurePanelMultiselection}
        title={t('Allow multiselection')}
        value={structurePanel.allowMultiselection}
      />
      <Toggler
        icon="textNode"
        onChange={showTextNodes}
        title={t('Show Text Nodes')}
        type="toggle"
        value={structurePanel.showTextNodes}
      />
      <AnimatePresence>
        {structurePanel.showTextNodes && (
          <Box
            component={motion.div}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
            overflow="hidden"
          >
            <Toggler
              disabled={!structurePanel.showTextNodes}
              icon="shortText"
              onChange={showTextNodesContent}
              title={t('Show Text Nodes Content')}
              type="toggle"
              value={structurePanel.showTextNodesContent}
            />
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
};
