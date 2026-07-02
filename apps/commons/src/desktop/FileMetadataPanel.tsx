import { Box, Paper, Stack, TextField, Typography } from '@mui/material';
import {
  applyFileHeaderFields,
  documentSupportsFileMetadata,
  getFileMetadataFieldsForCatalog,
  pushXmlToActiveEditor,
  readFileMetadataFromXml,
} from '@src/desktop/fileMetadata';
import { useActions, useAppState } from '@src/overmind';
import { useCallback, useEffect, useRef, useState } from 'react';

const getActiveXmlContent = (
  filePath: string,
  openTabs: { content: string; filePath: string }[],
  activeTabPath: string | null,
): string => {
  if (activeTabPath === filePath && window.writer?.overmindState?.ui?.editorViewMode === 'source') {
    return window.writer.overmindState.ui.sourceCurrentContent;
  }
  if (activeTabPath === filePath && window.__desktopStoredDocumentXml) {
    return window.__desktopStoredDocumentXml;
  }
  return openTabs.find((tab) => tab.filePath === filePath)?.content ?? '';
};

export const FileMetadataPanel = () => {
  const { activeTabPath, config, openTabs } = useAppState().project;
  const { readonly } = useAppState().editor;
  const { markTabDirty, updateTabContent } = useActions().project;

  const [values, setValues] = useState<Record<string, string>>({});
  const skipNextSyncRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef(values);

  const activeTab = openTabs.find((tab) => tab.filePath === activeTabPath);
  const catalogId = config?.schema?.catalogId;
  const metadataFields = getFileMetadataFieldsForCatalog(catalogId);
  const xml = activeTabPath ? getActiveXmlContent(activeTabPath, openTabs, activeTabPath) : '';
  const supported = Boolean(activeTabPath && xml && documentSupportsFileMetadata(xml, catalogId));

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    if (!activeTabPath || !xml) {
      setValues({});
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    setValues(readFileMetadataFromXml(xml, catalogId));
  }, [activeTabPath, activeTab?.content, catalogId, xml]);

  const commitChanges = useCallback(
    (nextValues: Record<string, string>) => {
      if (!activeTabPath || readonly) return;

      const currentXml = getActiveXmlContent(activeTabPath, openTabs, activeTabPath);
      if (!currentXml) return;

      const nextXml = applyFileHeaderFields(currentXml, nextValues, catalogId);
      if (nextXml === currentXml) return;

      skipNextSyncRef.current = true;
      pushXmlToActiveEditor({
        content: nextXml,
        filePath: activeTabPath,
        markTabDirty,
        updateTabContent,
      });
    },
    [activeTabPath, catalogId, markTabDirty, openTabs, readonly, updateTabContent],
  );

  const handleFieldChange = (path: string, value: string) => {
    const nextValues = { ...valuesRef.current, [path]: value };
    valuesRef.current = nextValues;
    setValues(nextValues);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitChanges(nextValues), 300);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  if (!activeTabPath) {
    return (
      <Paper elevation={0} square sx={{ height: '100%', p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Open a file to edit its metadata.
        </Typography>
      </Paper>
    );
  }

  if (!supported) {
    return (
      <Paper elevation={0} square sx={{ height: '100%', p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Per-file metadata is available for TEI and Orlando documents with a header. Edition-wide
          defaults are in Project → Edition metadata….
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      square
      sx={[
        { height: '100%', overflow: 'auto', p: 2 },
        (theme) =>
          theme.applyStyles('dark', {
            bgcolor: theme.vars.palette.background.paper,
          }),
      ]}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle2">File metadata</Typography>
        {metadataFields.map((field) => (
          <TextField
            key={field.path}
            disabled={readonly}
            fullWidth
            label={field.label}
            minRows={field.label === 'Source' ? 3 : undefined}
            multiline={field.label === 'Source'}
            onChange={(event) => handleFieldChange(field.path, event.target.value)}
            size="small"
            value={values[field.path] ?? ''}
          />
        ))}
        <Box>
          <Typography color="text.secondary" variant="caption">
            Project-wide defaults: Project → Edition metadata…
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};
