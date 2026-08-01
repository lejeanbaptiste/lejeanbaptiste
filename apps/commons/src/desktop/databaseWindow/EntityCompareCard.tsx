import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { CompareCardModel } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/hygiene';

const Field = ({
  label,
  children,
  highlight,
}: {
  label: string;
  children: ReactNode;
  highlight?: boolean;
}) => (
  <Box
    sx={{
      px: 0.5,
      py: 0.25,
      borderRadius: 0.5,
      bgcolor: highlight ? 'warning.light' : 'transparent',
    }}
  >
    <Typography variant="caption" color="text.secondary" component="div">
      {label}
    </Typography>
    {children}
  </Box>
);

const dash = (
  <Typography variant="caption" color="text.disabled">
    —
  </Typography>
);

export const EntityCompareCard = ({
  model,
  selected,
  onSelect,
}: {
  model: CompareCardModel;
  selected?: boolean;
  onSelect?: () => void;
}) => {
  const hl = new Set(model.highlightFields ?? []);
  const dateLabel =
    model.startYear != null || model.endYear != null
      ? `${model.startYear ?? '?'}–${model.endYear ?? '?'}`
      : null;

  return (
    <Box
      onClick={onSelect}
      sx={{
        flex: 1,
        minWidth: 0,
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 1,
        p: 1.5,
        cursor: onSelect ? 'pointer' : 'default',
        bgcolor: 'background.paper',
        outline: selected ? '2px solid' : 'none',
        outlineColor: 'primary.main',
      }}
    >
      <Stack spacing={1}>
        <Box>
          <Typography variant="subtitle1" noWrap>
            {model.title}
          </Typography>
          {model.subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {model.subtitle}
            </Typography>
          )}
        </Box>

        <Field label="Primary" highlight={hl.has('primary')}>
          <Typography variant="body2">{model.primaryName ?? dash}</Typography>
        </Field>

        <Field label="Romanized" highlight={hl.has('romanized')}>
          <Typography variant="body2">{model.romanized ?? dash}</Typography>
        </Field>

        <Stack direction="row" spacing={2}>
          <Field label="姓" highlight={hl.has('familyName')}>
            <Typography variant="body2">{model.familyName ?? dash}</Typography>
          </Field>
          <Field label="名" highlight={hl.has('givenName')}>
            <Typography variant="body2">{model.givenName ?? dash}</Typography>
          </Field>
        </Stack>

        <Field label="Other names" highlight={hl.has('otherNames')}>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {model.otherNames.length === 0
              ? dash
              : model.otherNames.map((name, index) => (
                  <Chip
                    key={`${name.text}-${index}`}
                    size="small"
                    label={name.type ? `${name.text} (${name.type})` : name.text}
                  />
                ))}
          </Stack>
        </Field>

        <Field label="Dates" highlight={hl.has('dates')}>
          <Typography variant="body2">{dateLabel ?? dash}</Typography>
        </Field>

        <Field label="Dynasties / nationalities" highlight={hl.has('nationalities')}>
          <Typography variant="body2">
            {model.nationalities.length ? model.nationalities.join(', ') : dash}
          </Typography>
        </Field>

        <Field label="Origin" highlight={hl.has('origins')}>
          <Typography variant="body2">
            {model.placesOfOrigin.length ? model.placesOfOrigin.join(', ') : dash}
          </Typography>
        </Field>

        <Field label="Roles" highlight={hl.has('roles')}>
          <Typography variant="body2">
            {model.roles?.length ? model.roles.join(', ') : dash}
          </Typography>
        </Field>

        <Field label="Noble titles" highlight={hl.has('nobleTitles')}>
          <Typography variant="body2">
            {model.nobleTitles?.length ? model.nobleTitles.join(', ') : dash}
          </Typography>
        </Field>

        <Field label="Description" highlight={hl.has('description')}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {model.description?.trim() ? model.description : dash}
          </Typography>
        </Field>

        <Field label="Authorities" highlight={hl.has('authorities')}>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {model.authorities.length === 0
              ? dash
              : model.authorities.map((auth, index) => (
                  <Chip
                    key={`${auth.type}-${auth.value}-${index}`}
                    size="small"
                    variant="outlined"
                    label={`${auth.type}: ${auth.value}`}
                  />
                ))}
          </Stack>
        </Field>
      </Stack>
    </Box>
  );
};
