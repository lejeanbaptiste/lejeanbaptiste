import {
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AuthorPillField } from '@src/desktop/AuthorPillField';
import {
  applyFileHeaderFields,
  documentSupportsFileMetadata,
  isTeiCatalogForFileMetadata,
  pushXmlToActiveEditor,
  readFileMetadataFromXml,
} from '@src/desktop/fileMetadata';
import {
  readMetadataFieldsTemplate,
  resolveFileMetadataFields,
  type MetadataFieldsTemplate,
} from '@src/desktop/metadataFieldsTemplate';
import {
  applySourceDescriptionToXml,
  emptySourceDescription,
  readSourceDescriptionFromXml,
  type SourceAuthor,
  type SourceDescription,
} from '@src/desktop/sourceDescription';
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

/** Structured TEI source metadata: book title, authors, dates, edition, source. */
const TeiSourceFields = ({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (next: SourceDescription) => void;
  value: SourceDescription;
}) => {
  const isRange = value.workDate.when === undefined &&
    (value.workDate.notBefore !== undefined || value.workDate.notAfter !== undefined);
  const [rangeMode, setRangeMode] = useState(isRange);

  useEffect(() => {
    setRangeMode(isRange);
    // Only resync the toggle when the underlying document changes shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRange]);

  const update = (patch: Partial<SourceDescription>) => onChange({ ...value, ...patch });

  const toggleRange = (checked: boolean) => {
    setRangeMode(checked);
    if (checked) {
      update({
        workDate: value.workDate.when
          ? { notBefore: value.workDate.when, notAfter: value.workDate.when }
          : { notBefore: value.workDate.notBefore, notAfter: value.workDate.notAfter },
      });
    } else {
      update({
        workDate: { when: value.workDate.notBefore || value.workDate.notAfter || undefined },
      });
    }
  };

  return (
    <>
      <TextField
        disabled={disabled}
        fullWidth
        label="Book title"
        onChange={(event) => update({ title: event.target.value })}
        size="small"
        value={value.title}
      />

      <AuthorPillField
        authors={value.authors}
        disabled={disabled}
        onChange={(authors: SourceAuthor[]) => update({ authors })}
      />

      <Box>
        <Stack alignItems="center" direction="row" spacing={1}>
          {rangeMode ? (
            <>
              <TextField
                disabled={disabled}
                label="Not before"
                onChange={(event) =>
                  update({
                    workDate: { ...value.workDate, when: undefined, notBefore: event.target.value },
                  })
                }
                size="small"
                sx={{ flex: 1 }}
                value={value.workDate.notBefore ?? ''}
              />
              <TextField
                disabled={disabled}
                label="Not after"
                onChange={(event) =>
                  update({
                    workDate: { ...value.workDate, when: undefined, notAfter: event.target.value },
                  })
                }
                size="small"
                sx={{ flex: 1 }}
                value={value.workDate.notAfter ?? ''}
              />
            </>
          ) : (
            <TextField
              disabled={disabled}
              label="Year"
              onChange={(event) => update({ workDate: { when: event.target.value } })}
              size="small"
              sx={{ flex: 1 }}
              value={value.workDate.when ?? ''}
            />
          )}
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={rangeMode}
              disabled={disabled}
              onChange={(event) => toggleRange(event.target.checked)}
              size="small"
            />
          }
          label={
            <Typography color="text.secondary" variant="caption">
              Uncertain date (not before / not after)
            </Typography>
          }
        />
      </Box>

      <Stack direction="row" spacing={1}>
        <TextField
          disabled={disabled}
          label="Edition"
          onChange={(event) => update({ edition: event.target.value })}
          size="small"
          sx={{ flex: 2 }}
          value={value.edition}
        />
        <TextField
          disabled={disabled}
          label="Year of edition"
          onChange={(event) => update({ editionDate: event.target.value })}
          size="small"
          sx={{ flex: 1 }}
          value={value.editionDate}
        />
      </Stack>

      <TextField
        disabled={disabled}
        fullWidth
        label="Transcription source"
        minRows={3}
        multiline
        onChange={(event) => update({ sourceNote: event.target.value })}
        size="small"
        value={value.sourceNote}
      />
    </>
  );
};

export const FileMetadataPanel = () => {
  const { activeTabPath, config, openTabs, rootPath } = useAppState().project;
  const { readonly } = useAppState().editor;
  const { markTabDirty, updateTabContent } = useActions().project;

  const [values, setValues] = useState<Record<string, string>>({});
  const [sourceValues, setSourceValues] = useState<SourceDescription>(emptySourceDescription());
  const skipNextSyncRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef(values);
  const sourceValuesRef = useRef(sourceValues);

  const [fieldsTemplate, setFieldsTemplate] = useState<MetadataFieldsTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!rootPath) {
      setFieldsTemplate(null);
      return;
    }
    readMetadataFieldsTemplate(rootPath).then((template) => {
      if (!cancelled) setFieldsTemplate(template);
    });
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  const activeTab = openTabs.find((tab) => tab.filePath === activeTabPath);
  const catalogId = config?.schema?.catalogId;
  // Structured TEI fields unless a project template overrides the file fields.
  const structured =
    isTeiCatalogForFileMetadata(catalogId) && !(fieldsTemplate?.file?.length ?? 0);
  const metadataFields = resolveFileMetadataFields(fieldsTemplate, catalogId);
  const xml = activeTabPath ? getActiveXmlContent(activeTabPath, openTabs, activeTabPath) : '';
  const supported = Boolean(activeTabPath && xml && documentSupportsFileMetadata(xml, catalogId));

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    sourceValuesRef.current = sourceValues;
  }, [sourceValues]);

  useEffect(() => {
    if (!activeTabPath || !xml) {
      setValues({});
      setSourceValues(emptySourceDescription());
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (structured) {
      setSourceValues(readSourceDescriptionFromXml(xml));
    } else {
      setValues(readFileMetadataFromXml(xml, catalogId, fieldsTemplate?.file));
    }
  }, [activeTabPath, activeTab?.content, catalogId, fieldsTemplate, structured, xml]);

  const pushUpdatedXml = useCallback(
    (nextXml: string, currentXml: string) => {
      if (!activeTabPath || nextXml === currentXml) return;
      skipNextSyncRef.current = true;
      pushXmlToActiveEditor({
        content: nextXml,
        filePath: activeTabPath,
        markTabDirty,
        updateTabContent,
      });
    },
    [activeTabPath, markTabDirty, updateTabContent],
  );

  const commitChanges = useCallback(
    (nextValues: Record<string, string>) => {
      if (!activeTabPath || readonly) return;
      const currentXml = getActiveXmlContent(activeTabPath, openTabs, activeTabPath);
      if (!currentXml) return;
      pushUpdatedXml(applyFileHeaderFields(currentXml, nextValues, catalogId), currentXml);
    },
    [activeTabPath, catalogId, openTabs, pushUpdatedXml, readonly],
  );

  const commitSourceChanges = useCallback(
    (next: SourceDescription) => {
      if (!activeTabPath || readonly) return;
      const currentXml = getActiveXmlContent(activeTabPath, openTabs, activeTabPath);
      if (!currentXml) return;
      pushUpdatedXml(applySourceDescriptionToXml(currentXml, next), currentXml);
    },
    [activeTabPath, openTabs, pushUpdatedXml, readonly],
  );

  const handleFieldChange = (path: string, value: string) => {
    const nextValues = { ...valuesRef.current, [path]: value };
    valuesRef.current = nextValues;
    setValues(nextValues);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitChanges(nextValues), 300);
  };

  const handleSourceChange = (next: SourceDescription) => {
    sourceValuesRef.current = next;
    setSourceValues(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitSourceChanges(next), 300);
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
        {structured ? (
          <TeiSourceFields
            disabled={readonly}
            onChange={handleSourceChange}
            value={sourceValues}
          />
        ) : (
          metadataFields.map((field) => (
            <TextField
              key={field.path}
              disabled={readonly}
              fullWidth
              label={field.label}
              minRows={field.multiline || field.label === 'Source' ? 3 : undefined}
              multiline={Boolean(field.multiline) || field.label === 'Source'}
              onChange={(event) => handleFieldChange(field.path, event.target.value)}
              size="small"
              value={values[field.path] ?? ''}
            />
          ))
        )}
        <Box>
          <Typography color="text.secondary" variant="caption">
            Project-wide defaults: Project → Edition metadata…
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};
