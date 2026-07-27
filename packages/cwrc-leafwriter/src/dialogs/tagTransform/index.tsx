import AddIcon from '@mui/icons-material/Add';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TAG_BOMB_SCOPES,
  TAG_BOMB_SCOPE_LABEL_KEYS,
  type TagBombScope,
} from '../../autoTagging/tagBombScope';
import { AutoTaggingSession } from '../../autoTagging/integration';
import type { IDialog } from '../type';

interface AttributeRule {
  name: string;
  value: string;
  negated: boolean;
}
const INFRASTRUCTURE = new Set([
  'pb',
  'lb',
  'cb',
  'milestone',
  'anchor',
  'ptr',
  'gap',
  'teiHeader',
  'fileDesc',
  'titleStmt',
  'publicationStmt',
  'sourceDesc',
  'encodingDesc',
  'profileDesc',
  'textClass',
  'revisionDesc',
  'change',
]);

const emptyRule = (): AttributeRule => ({ name: '', value: '', negated: false });

const RuleList = ({
  rules,
  onChange,
  label,
  tag,
  isAttributeValid,
  invalidLabel,
}: {
  rules: AttributeRule[];
  onChange: (next: AttributeRule[]) => void;
  label: string;
  tag: string;
  isAttributeValid: (attribute: string, tag: string) => boolean;
  invalidLabel: string;
}) => {
  const { t: translate } = useTranslation();
  const t = (key: string, fallback?: string) =>
    translate(key.replace('LW.tagTransform', 'LW.settings.tagTransform'), fallback);
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption">{label}</Typography>
      {rules.map((rule, index) => (
        <Stack direction="row" spacing={0.5} key={index} alignItems="center">
          <IconButton
            size="small"
            title={t('LW.tagTransform.not', 'Negate')}
            onClick={() =>
              onChange(rules.map((r, i) => (i === index ? { ...r, negated: !r.negated } : r)))
            }
            color={rule.negated ? 'warning' : 'default'}
          >
            <RemoveCircleOutlineIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small"
            label={t('LW.tagTransform.attribute', 'Attribute')}
            value={rule.name}
            error={Boolean(rule.name.trim() && !isAttributeValid(rule.name, tag))}
            helperText={
              rule.name.trim() && !isAttributeValid(rule.name, tag) ? invalidLabel : undefined
            }
            onChange={(e) =>
              onChange(rules.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
            }
          />
          <TextField
            size="small"
            label={t('LW.tagTransform.value', 'Value')}
            value={rule.value}
            onChange={(e) =>
              onChange(rules.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
            }
          />
        </Stack>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange([...rules, emptyRule()])}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('LW.tagTransform.add_attribute', 'Add field')}
      </Button>
    </Stack>
  );
};

export const TagTransformDialog = (props: IDialog) => {
  const { t: translate } = useTranslation();
  const t = (key: string, fallback?: string) =>
    translate(key.replace('LW.tagTransform', 'LW.settings.tagTransform'), fallback);
  const [findString, setFindString] = useState('');
  const [findTag, setFindTag] = useState('none');
  const [findTagNegated, setFindTagNegated] = useState(false);
  const [findKey, setFindKey] = useState('');
  const [findKeyValue, setFindKeyValue] = useState('');
  const [findAttributes, setFindAttributes] = useState<AttributeRule[]>([]);
  const [replaceString, setReplaceString] = useState('');
  const [replaceTag, setReplaceTag] = useState('none');
  const [replaceKey, setReplaceKey] = useState('');
  const [replaceKeyValue, setReplaceKeyValue] = useState('');
  const [replaceAttributes, setReplaceAttributes] = useState<AttributeRule[]>([]);
  const [purge, setPurge] = useState(() => localStorage.getItem('tagTransform.purge') === 'true');
  const [purgeTag, setPurgeTag] = useState(false);
  const [purgeChildren, setPurgeChildren] = useState(false);
  const [regex, setRegex] = useState(false);
  const [scope, setScope] = useState<TagBombScope>('currentFile');
  const [customPath, setCustomPath] = useState('');
  const [error, setError] = useState('');

  const schemaManager = window.writer?.schemaManager as unknown as
    | {
        isAttributeValidForTag?: (attribute: string, tag: string) => boolean;
      }
    | undefined;
  const isAttributeValid = (attribute: string, tag: string) =>
    tag === 'none' ||
    !attribute.trim() ||
    !schemaManager?.isAttributeValidForTag ||
    schemaManager.isAttributeValidForTag(attribute.trim(), tag);
  const invalidAttributeLabel = t(
    'LW.tagTransform.invalid_attribute',
    'Attribute is not valid for this tag.',
  );

  const tagOptions = useMemo(() => {
    const names = new Set<string>();
    const schemaElements =
      (window.writer?.schemaManager as unknown as { schema?: { elements?: string[] } } | undefined)
        ?.schema?.elements ?? [];
    schemaElements.forEach((name: string) => {
      if (!INFRASTRUCTURE.has(name)) names.add(name);
    });
    return ['none', ...Array.from(names).sort()];
  }, []);

  useEffect(() => {
    const selection = window.writer?.editor?.selection?.getRng?.();
    const node = selection?.commonAncestorContainer;
    let element = node instanceof Element ? node : node?.parentElement;
    if (!element) return;

    const schemaElements = new Set(
      (
        (
          window.writer?.schemaManager as unknown as
            { schema?: { elements?: string[] } } | undefined
        )?.schema?.elements ?? []
      ).map((name) => name.toLowerCase()),
    );
    let selected: Element | undefined;
    let selectedTag = '';
    while (element && element !== window.writer?.editor?.getBody?.()) {
      const visualTag = element.getAttribute('_tag');
      const candidateTag = visualTag || element.localName;
      const normalizedCandidateTag = candidateTag.toLowerCase();
      const blankContext =
        normalizedCandidateTag === 'p' ||
        normalizedCandidateTag === 'div' ||
        INFRASTRUCTURE.has(candidateTag);
      if (
        candidateTag &&
        (blankContext ||
          visualTag ||
          schemaElements.size === 0 ||
          schemaElements.has(normalizedCandidateTag))
      ) {
        selected = element;
        selectedTag = candidateTag;
        break;
      }
      element = element.parentElement;
    }
    if (!selected || !selectedTag) return;

    if (['p', 'div'].includes(selectedTag.toLowerCase()) || INFRASTRUCTURE.has(selectedTag)) {
      setFindString('');
      setReplaceString('');
      setFindTag('none');
      setReplaceTag('none');
      setFindKey('');
      setFindKeyValue('');
      setReplaceKey('');
      setReplaceKeyValue('');
      setFindAttributes([]);
      setReplaceAttributes([]);
      return;
    }

    const text = selected.textContent ?? '';
    setFindString(text);
    setReplaceString(text);
    setFindTag(selectedTag);
    setReplaceTag(selectedTag);

    let attributeValues: Record<string, string> = {};
    const storedAttributes = selected.getAttribute('_attributes');
    if (storedAttributes) {
      try {
        const parsed = JSON.parse(storedAttributes.replace(/&quot;/g, '"')) as Record<
          string,
          unknown
        >;
        attributeValues = Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
        ) as Record<string, string>;
      } catch {
        // Fall back to ordinary DOM attributes for non-visual-editor documents.
      }
    }
    if (Object.keys(attributeValues).length === 0) {
      for (const attribute of Array.from(selected.attributes)) {
        if (
          !attribute.name.startsWith('_') &&
          !['class', 'style', 'id', 'name'].includes(attribute.name)
        )
          attributeValues[attribute.name] = attribute.value;
      }
    }
    const key = attributeValues.key ?? '';
    setFindKey(key ? 'key' : '');
    setReplaceKey(key ? 'key' : '');
    setFindKeyValue(key);
    setReplaceKeyValue(key);
    const attrs = Object.entries(attributeValues)
      .filter(([name]) => name !== 'key')
      .map(([name, value]) => ({ name, value, negated: false }));
    setFindAttributes(attrs);
    setReplaceAttributes(attrs);
  }, []);

  const togglePurge = (checked: boolean) => {
    setPurge(checked);
    localStorage.setItem('tagTransform.purge', String(checked));
  };
  const run = async () => {
    setError('');
    const doc = window.writer?.editor?.getDoc?.();
    if (!doc || !findString.trim()) {
      setError(t('LW.tagTransform.required', 'Enter a string to find.'));
      return;
    }
    const editor = window.writer?.overmindState?.editor;
    if (scope !== 'currentFile' && !editor?.enableMultiFileAutomation) {
      setError(
        t(
          'LW.tagTransform.multi_file_disabled',
          'Enable multi-file automation in Guardrails first.',
        ),
      );
      return;
    }
    if (scope === 'custom' && !customPath.trim()) {
      setError(t('LW.tagTransform.custom_folder_required', 'Choose a folder for this scope.'));
      return;
    }
    const validateAttributes = (tag: string, rules: AttributeRule[], key: string) => {
      if (tag === 'none') return true;
      return [key, ...rules.map((rule) => rule.name)].every((name) => isAttributeValid(name, tag));
    };
    if (
      !validateAttributes(findTag, findAttributes, findKey) ||
      (purge
        ? !validateAttributes(findTag, replaceAttributes, '')
        : !validateAttributes(replaceTag, replaceAttributes, replaceKey))
    ) {
      setError(
        t(
          'LW.tagTransform.invalid_attribute',
          'One or more attributes are not valid for the selected schema tag.',
        ),
      );
      return;
    }
    const isMultiFile = scope !== 'currentFile';
    const isCorpusWide = scope === 'project';
    const shouldSnapshot =
      isMultiFile &&
      (editor?.multiFileSnapshotBefore === 'multiFile' ||
        (editor?.multiFileSnapshotBefore === 'corpusWide' && isCorpusWide));
    try {
      const session = new AutoTaggingSession(window.writer, 'ignore');
      if (shouldSnapshot) {
        const snapshot =
          await window.__leafWriterProject?.createTimeMachineSnapshot?.('tag-transform');
        if (!snapshot?.ok) {
          setError(
            t(
              'LW.tagTransform.snapshot_failed',
              'The safety snapshot could not be created. No changes were made.',
            ),
          );
          return;
        }
      }
      const result = await session.runTagTransform({
        string: findString,
        regex,
        tagName: findTag === 'none' ? '*' : findTag,
        tagNegated: findTag !== 'none' && findTagNegated,
        key: findKey ? { name: findKey, value: findKeyValue } : undefined,
        attributes: findAttributes,
        purgeTag: purge && purgeTag,
        purgeChildren,
        replaceTagName: purge ? undefined : replaceTag === 'none' ? '*' : replaceTag,
        replaceString,
        replaceKey: !purge && replaceKey ? { name: replaceKey, value: replaceKeyValue } : undefined,
        changes: replaceAttributes
          .filter((a) => a.name.trim())
          .map((a) => ({ name: a.name, value: a.value, remove: purge })),
        scope,
        customPath,
        validateOtherFiles: isMultiFile && (editor?.validateMultiFileAutomation ?? true),
      });
      if (!result.matches) {
        setError(t('LW.tagTransform.no_matches', 'No matching content found.'));
        return;
      }
      window.writer?.overmindActions?.ui?.notifyViaSnackbar?.({
        message: t('LW.tagTransform.applied', {
          count: result.matches,
          files: result.filesChanged,
        }),
      });
      props.onClose?.('apply');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Dialog
      open={props.open ?? false}
      onClose={() => props.onClose?.('cancel')}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t('LW.tagTransform.title', 'Advanced tag transform')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="subtitle2">{t('LW.tagTransform.find', 'Find')}</Typography>
          <TextField
            fullWidth
            size="small"
            label={t('LW.tagTransform.string', 'String')}
            value={findString}
            onChange={(e) => {
              setFindString(e.target.value);
              if (!replaceString) setReplaceString(e.target.value);
            }}
          />
          <FormControlLabel
            control={
              <Checkbox size="small" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
            }
            label={t('LW.tagTransform.regex', 'Regular expression')}
          />
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton
              size="small"
              title={t('LW.tagTransform.not', 'Negate')}
              onClick={() => setFindTagNegated((value) => !value)}
              color={findTagNegated ? 'warning' : 'default'}
            >
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
            <Select
              fullWidth
              size="small"
              value={findTag}
              onChange={(e) => setFindTag(e.target.value)}
              displayEmpty
            >
              {tagOptions.map((tag) => (
                <MenuItem key={tag} value={tag}>
                  {tag === 'none' ? t('LW.tagTransform.none', 'None') : `<${tag}>`}
                </MenuItem>
              ))}
            </Select>
          </Stack>
          {scope === 'custom' && (
            <TextField
              size="small"
              label={t('LW.tagTransform.custom_folder', 'Folder')}
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
            />
          )}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField
              size="small"
              label={t('LW.tagTransform.key_attribute', 'Key attribute')}
              value={findKey}
              error={Boolean(findKey.trim() && !isAttributeValid(findKey, findTag))}
              helperText={
                findKey.trim() && !isAttributeValid(findKey, findTag)
                  ? invalidAttributeLabel
                  : undefined
              }
              onChange={(e) => setFindKey(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label={t('LW.tagTransform.value', 'Value')}
              value={findKeyValue}
              onChange={(e) => setFindKeyValue(e.target.value)}
            />
          </Stack>
          <RuleList
            label={t('LW.tagTransform.additional_fields', 'Additional fields')}
            rules={findAttributes}
            onChange={setFindAttributes}
            tag={findTag}
            isAttributeValid={isAttributeValid}
            invalidLabel={invalidAttributeLabel}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">{t('LW.tagTransform.replace', 'Replace')}</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={purge}
                  onChange={(e) => togglePurge(e.target.checked)}
                />
              }
              label={t('LW.tagTransform.purge', 'Purge')}
            />
          </Stack>
          {purge ? (
            <Stack spacing={0.5}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={purgeTag}
                    onChange={(e) => setPurgeTag(e.target.checked)}
                  />
                }
                label={t('LW.tagTransform.purge_tag', 'Purge tag')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={purgeChildren}
                    onChange={(e) => setPurgeChildren(e.target.checked)}
                  />
                }
                label={t('LW.tagTransform.purge_children', 'Purge children')}
              />
              <RuleList
                label={t('LW.tagTransform.purge_attributes', 'Attributes to purge')}
                rules={replaceAttributes}
                onChange={setReplaceAttributes}
                tag={findTag}
                isAttributeValid={isAttributeValid}
                invalidLabel={invalidAttributeLabel}
              />
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ opacity: 0.65 }}>
              <TextField
                fullWidth
                size="small"
                disabled
                label={t('LW.tagTransform.string', 'String')}
                value={replaceString}
              />
              <Select
                size="small"
                value={replaceTag}
                onChange={(e) => setReplaceTag(e.target.value)}
                displayEmpty
              >
                {tagOptions.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag === 'none' ? t('LW.tagTransform.none', 'None') : `<${tag}>`}
                  </MenuItem>
                ))}
              </Select>
              <Stack direction="row" spacing={0.5}>
                <TextField
                  size="small"
                  label={t('LW.tagTransform.key_attribute', 'Key attribute')}
                  value={replaceKey}
                  error={Boolean(replaceKey.trim() && !isAttributeValid(replaceKey, replaceTag))}
                  helperText={
                    replaceKey.trim() && !isAttributeValid(replaceKey, replaceTag)
                      ? invalidAttributeLabel
                      : undefined
                  }
                  onChange={(e) => setReplaceKey(e.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  label={t('LW.tagTransform.value', 'Value')}
                  value={replaceKeyValue}
                  onChange={(e) => setReplaceKeyValue(e.target.value)}
                />
              </Stack>
              <RuleList
                label={t('LW.tagTransform.additional_fields', 'Additional fields')}
                rules={replaceAttributes}
                onChange={setReplaceAttributes}
                tag={replaceTag}
                isAttributeValid={isAttributeValid}
                invalidLabel={invalidAttributeLabel}
              />
            </Stack>
          )}
          <Select
            size="small"
            value={scope}
            onChange={(e) => setScope(e.target.value as TagBombScope)}
          >
            {TAG_BOMB_SCOPES.map((item) => (
              <MenuItem key={item} value={item}>
                {t(TAG_BOMB_SCOPE_LABEL_KEYS[item])}
              </MenuItem>
            ))}
          </Select>
          {error && (
            <Typography color="error" variant="caption">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose?.('cancel')}>{t('LW.common.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={run}>
          {t('LW.tagTransform.apply', 'Apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
