import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { NameTypeId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypes';
import { nameTypeLabel } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypeLabels';
import { SourceBadges } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/SourceBadges';
import { FIXED_LANGUAGE_OPTIONS } from '../../../../../packages/cwrc-leafwriter/src/utilities/languageCodes';

export interface NameRow {
  key: string;
  text: string;
  sources: string[];
  keys: string[];
  isValidated: boolean;
  isPrimary: boolean;
}

interface EntityNamesAccordionProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  rows: NameRow[];
  allowedNameTypes: readonly NameTypeId[];
  projectLang: string | null;
  validatedSourceLabel: string;
  nameTypes: Record<string, string>;
  nameLanguages: Record<string, string>;
  onNameTypeChange: (text: string, type: string) => void;
  onNameLanguageChange: (text: string, language: string) => void;
  onValidate: (keys: string[]) => void;
  onReject: (keys: string[]) => void;
  onDelete: (text: string) => void;
  newName: string;
  onNewNameChange: (value: string) => void;
  newNameType: string;
  onNewNameTypeChange: (value: string) => void;
  newNameLanguage: string;
  onNewNameLanguageChange: (value: string) => void;
  onAdd: () => void;
  title: string;
  hint: string;
  addPlaceholder: string;
}

/** Compact display codes for the closed select (full labels stay on menu item hover). */
const shortLanguageCode = (code: string): string => {
  if (!code) return '—';
  if (code === 'zh-Hant') return 'ZHT';
  if (code === 'zh-Hans') return 'ZHS';
  return (code.split('-')[0] ?? code).toUpperCase();
};

const languageSelectSx = {
  minWidth: 56,
  maxWidth: 64,
  flex: '0 0 auto',
  '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: 12, textAlign: 'center' as const },
  '& .MuiSelect-select': { pr: '8px !important' },
};

export function EntityNamesAccordion({
  expanded,
  onExpandedChange,
  rows,
  allowedNameTypes,
  projectLang,
  validatedSourceLabel,
  nameTypes,
  nameLanguages,
  onNameTypeChange,
  onNameLanguageChange,
  onValidate,
  onReject,
  onDelete,
  newName,
  onNewNameChange,
  newNameType,
  onNewNameTypeChange,
  newNameLanguage,
  onNewNameLanguageChange,
  onAdd,
  title,
  hint,
  addPlaceholder,
}: EntityNamesAccordionProps) {
  const { t } = useTranslation();
  const neutralActionButtonSx = { color: 'text.secondary', p: 0.25 };
  const languageAriaLabel = t('LWC.desktop.sidebar.database.translation_language');

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_event, nextExpanded) => onExpandedChange(nextExpanded)}
      sx={{
        mt: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon fontSize="small" />}
        sx={{ minHeight: 0, '& .MuiAccordionSummary-content': { my: 1 } }}
      >
        <Typography variant="subtitle2">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
          {rows.map((row) => (
            <Stack key={row.key} direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" noWrap>
                {row.text}
              </Typography>
              <TextField
                select
                size="small"
                value={nameTypes[row.text] ?? ''}
                onChange={(event) => onNameTypeChange(row.text, event.target.value)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  '& .MuiInputBase-input': { py: 0.5, fontSize: 12 },
                }}
                SelectProps={{ IconComponent: () => null }}
              >
                <MenuItem value="">
                  <em>{t('LWC.desktop.sidebar.database.name_types.unclassified')}</em>
                </MenuItem>
                {allowedNameTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {nameTypeLabel(type, projectLang)}
                  </MenuItem>
                ))}
              </TextField>
              {nameTypes[row.text] === 'translation' && (
                <TextField
                  select
                  size="small"
                  aria-label={languageAriaLabel}
                  value={nameLanguages[row.text] ?? ''}
                  onChange={(event) => onNameLanguageChange(row.text, event.target.value)}
                  sx={languageSelectSx}
                  SelectProps={{
                    IconComponent: () => null,
                    renderValue: (selected) => shortLanguageCode(String(selected ?? '')),
                    MenuProps: { PaperProps: { sx: { maxHeight: 320 } } },
                  }}
                >
                  <MenuItem value="">—</MenuItem>
                  {FIXED_LANGUAGE_OPTIONS.map((option) => (
                    <MenuItem key={option.code} value={option.code} title={option.label}>
                      {shortLanguageCode(option.code)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {row.sources.length > 0 && <SourceBadges label={row.sources.join('+')} />}
              {row.isValidated && <SourceBadges label={validatedSourceLabel} />}
              {row.keys.length > 0 && (
                <Tooltip title={t('LWC.desktop.sidebar.database.validate_data')}>
                  <IconButton
                    size="small"
                    sx={neutralActionButtonSx}
                    onClick={() => onValidate(row.keys)}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('LWC.desktop.sidebar.database.delete_name')}>
                <IconButton
                  size="small"
                  aria-label={t('LWC.desktop.sidebar.database.delete_name')}
                  onClick={() => onDelete(row.text)}
                  sx={neutralActionButtonSx}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              fullWidth
              size="small"
              label={addPlaceholder}
              value={newName}
              onChange={(event) => onNewNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onAdd();
                }
              }}
            />
            <TextField
              select
              size="small"
              value={newNameType}
              onChange={(event) => onNewNameTypeChange(event.target.value)}
              sx={{ minWidth: 120 }}
              SelectProps={{ IconComponent: () => null }}
            >
              <MenuItem value="">
                <em>{t('LWC.desktop.sidebar.database.name_types.unclassified')}</em>
              </MenuItem>
              {allowedNameTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {nameTypeLabel(type, projectLang)}
                </MenuItem>
              ))}
            </TextField>
            {newNameType === 'translation' && (
              <TextField
                select
                size="small"
                aria-label={languageAriaLabel}
                value={newNameLanguage}
                onChange={(event) => onNewNameLanguageChange(event.target.value)}
                sx={languageSelectSx}
                SelectProps={{
                  IconComponent: () => null,
                  renderValue: (selected) => shortLanguageCode(String(selected ?? '')),
                  MenuProps: { PaperProps: { sx: { maxHeight: 320 } } },
                }}
              >
                <MenuItem value="">—</MenuItem>
                {FIXED_LANGUAGE_OPTIONS.map((option) => (
                  <MenuItem key={option.code} value={option.code} title={option.label}>
                    {shortLanguageCode(option.code)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="outlined"
              size="small"
              disabled={!newName.trim() || (newNameType === 'translation' && !newNameLanguage)}
              onClick={onAdd}
            >
              {t('LWC.desktop.sidebar.database.add_name')}
            </Button>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
