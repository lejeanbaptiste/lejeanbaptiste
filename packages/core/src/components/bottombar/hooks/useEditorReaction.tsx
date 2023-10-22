import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Divider, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SeverityType } from '../../../dialogs';
import { useActions, useAppState } from '../../../overmind';
import { TextEmphasis } from '../../TextEmphasis';

export interface ActionParams {
  value: string;
  isUndo?: boolean;
}

export interface MessageResponseProps {
  severity?: SeverityType;
  text: React.ReactNode;
}

const useEditorReaction = () => {
  const { schemaName } = useAppState().document;
  const { schemasList } = useAppState().editor;
  const { document, editor } = useActions();

  const { t } = useTranslation('leafwriter');

  return {
    editorModeShouldChange: (editorMode: string): [boolean, null | MessageResponseProps] => {
      const writer = window.writer;

      let doChange = false;

      if (editorMode === 'xml' && writer.mode !== writer.XML) {
        doChange = true;
      } else if (editorMode === 'xmlrdf') {
        if (writer.mode !== writer.XMLRDF || writer.allowOverlap) doChange = true;
      } else if (editorMode === 'xmlrdfoverlap') {
        if (writer.mode !== writer.XMLRDF || !writer.allowOverlap) doChange = true;
      } else if (editorMode === 'rdf') {
        if (writer.mode !== writer.RDF || !writer.allowOverlap) doChange = true;
      }

      if (!doChange) return [false, null];

      const existingOverlaps = writer.entitiesManager.doEntitiesOverlap();

      if (editorMode === 'xml') {
        return [
          true,
          {
            severity: 'warning',
            text: (
              <Typography paragraph>
                <TextEmphasis color="warning">Markup only</TextEmphasis>{' '}
                {t(
                  'The existing RDF annotations will be discarded and no RDF will be created when tagging entities',
                )}
              </Typography>
            ),
          },
        ];
      }

      // switching from xml mode to no-overlap
      if (editorMode === 'xmlrdf' && writer.mode === writer.XML) {
        return [
          true,
          {
            severity: 'info',
            text: (
              <Typography paragraph>
                <TextEmphasis color="info">Markup and Linking</TextEmphasis>{' '}
                {t(
                  'XML tags and RDF - Semantic Web annotations equivalent to the XML tags will be created consistent with the hierarchy of the XML schema so annotations will not be allowed to overlap',
                )}
              </Typography>
            ),
          },
        ];
      }

      // switching from no-overlap to overlap
      if (editorMode === 'xmlrdfoverlap' && !writer.allowOverlap) {
        return [
          true,
          {
            severity: 'info',
            text: (
              <Typography paragraph>
                <TextEmphasis color="info">Markup and Linking with overlap</TextEmphasis>{' '}
                {t('Only RDF will be created for entities that overlap existing XML structures')}
              </Typography>
            ),
          },
        ];
      }

      // switching from overlap to no-overlap
      if (writer.allowOverlap && editorMode !== 'xmlrdfoverlap' && existingOverlaps) {
        return [
          true,
          {
            severity: 'warning',
            text: (
              <Typography paragraph>
                <TextEmphasis color="warning">Markup and Linking with overlap</TextEmphasis>{' '}
                {t(
                  'You have overlapping entities and are attemping to switch to a mode which prohibits them The overlapping entities will be discarded if you continue',
                )}
              </Typography>
            ),
          },
        ];
      }

      // TODO rdf message = Linking Only
      if (editorMode === 'rdf') {
        return [true, { severity: 'warning', text: '' }];
      }

      return [true, null];
    },

    changeEditorMode: ({ value, isUndo }: ActionParams) => {
      const editorMode = editor.setEditorMode(value);

      let message = isUndo ? t('Editor Mode restored') : t('Editor Mode has changed');
      if (editorMode) message = `${message}: ${editorMode.label}`;

      return message;
    },

    changeAnnotationMode: ({ value, isUndo }: { value: number; isUndo?: boolean }) => {
      const annotationMode = editor.setAnnotationrMode(value);

      let message = isUndo ? t('Annotation Mode restored') : t('Annotation Mode has changed');
      if (annotationMode) message = `${message}: ${annotationMode.label}`;

      return message;
    },

    schemaShouldChange: async (
      schemaId: string,
    ): Promise<[boolean, null | MessageResponseProps]> => {
      const { schemaManager, utilities } = window.writer;

      const currRootName = utilities.getRootTag().attr('_tag');
      const schema = schemasList.find((schema) => schema.id === schemaId);
      const roots = await schemaManager.getPossibleRootsForSchema(schemaId);

      if (roots.length === 0) {
        return [
          false,
          {
            severity: 'error',
            text: t(
              'The root element of the schema could not be determined and so it will not be used',
            ),
          },
        ];
      }

      if (!roots.includes(currRootName)) {
        return [
          true,
          {
            severity: 'warning',
            text: (
              <>
                <Typography paragraph>
                  {t(
                    `The current documents root element does not match the root elements required by the selected schema`,
                  )}
                  {t('Applying this schema change will cause a document loading error')}
                </Typography>
                <Grid container mb={2.5}>
                  <Grid item xs={5}>
                    <Typography fontWeight={700}>{t('Current document')}</Typography>
                    <Typography variant="body2">
                      Schema: <TextEmphasis color="info">{schemaName}</TextEmphasis>
                    </Typography>
                    <Typography variant="body2">
                      Root: <TextEmphasis color="info">{currRootName}</TextEmphasis>
                    </Typography>
                  </Grid>
                  <Divider orientation="vertical" flexItem>
                    <ChevronRightIcon />
                  </Divider>
                  <Grid item xs={6} pl={2}>
                    <Typography fontWeight={700}>{t('commons.change')}</Typography>
                    <Typography variant="body2">
                      Schema:{' '}
                      <TextEmphasis color="warning">
                        {schema ? schema.name : 'no schema'}
                      </TextEmphasis>
                    </Typography>
                    <Typography variant="body2">
                      Roots:{' '}
                      {roots.map((value, index) => (
                        <Typography key={value} component="span" variant="body2">
                          <TextEmphasis color="warning">{value}</TextEmphasis>
                          {index < roots.length - 1 && ', '}
                        </Typography>
                      ))}
                    </Typography>
                  </Grid>
                </Grid>
              </>
            ),
          },
        ];
      }

      return [true, null];
    },

    changeSchema: ({ value, isUndo }: ActionParams) => {
      const schema = document.setSchema(value);

      let message = isUndo ? t('Schema restored') : t('Schema has changed');
      if (schema) message = `${message}: ${schema.name}`;

      return message;
    },
  };
};

export default useEditorReaction;
