import {
  Autocomplete,
  Box,
  CircularProgress,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import {
  dynastySubtitle,
  eraSubtitle,
  filterDynasties,
  filterEras,
  filterRulers,
  rulerSubtitle,
} from './search';
import type {
  DateAuthorityIndex,
  DynastyAuthorityEntry,
  EastAsianDateValues,
  EraAuthorityEntry,
  RulerAuthorityEntry,
} from './types';

export interface EastAsianDateFieldsProps {
  authority: DateAuthorityIndex | null;
  disabled?: boolean;
  error?: string | null;
  loading?: boolean;
  onChange: (values: EastAsianDateValues) => void;
  values: EastAsianDateValues;
}

const optionKey = (prefix: string, id: number) => `${prefix}-${id}`;

export const EastAsianDateFields = ({
  authority,
  disabled = false,
  error,
  loading = false,
  onChange,
  values,
}: EastAsianDateFieldsProps) => {
  const dynastyOptions = authority?.dynasties ?? [];
  const rulerOptions = useMemo(
    () => (authority ? filterRulers(authority.rulers, values.dynId, '') : []),
    [authority, values.dynId],
  );
  const eraOptions = useMemo(
    () =>
      authority ? filterEras(authority.eras, values.dynId, values.rulerId, '') : [],
    [authority, values.dynId, values.rulerId],
  );

  const selectedDynasty =
    dynastyOptions.find((entry) => String(entry.dynId) === values.dynId) ?? null;
  const selectedRuler =
    rulerOptions.find((entry) => String(entry.rulerId) === values.rulerId) ?? null;
  const selectedEra = eraOptions.find((entry) => String(entry.eraId) === values.eraId) ?? null;

  const patch = (partial: Partial<EastAsianDateValues>) => {
    onChange({ ...values, ...partial });
  };

  const handleDynasty = (entry: DynastyAuthorityEntry | null) => {
    if (!entry) {
      patch({ dynId: '', rulerId: '', eraId: '' });
      return;
    }
    const dynId = String(entry.dynId);
    const next: Partial<EastAsianDateValues> = { dynId };
    if (values.rulerId) {
      const ruler = authority?.rulers.find((r) => String(r.rulerId) === values.rulerId);
      if (!ruler || String(ruler.dynId) !== dynId) next.rulerId = '';
    }
    if (values.eraId) {
      const era = authority?.eras.find((e) => String(e.eraId) === values.eraId);
      if (!era || String(era.dynId) !== dynId) next.eraId = '';
    }
    patch(next);
  };

  const handleRuler = (entry: RulerAuthorityEntry | null) => {
    if (!entry) {
      patch({ rulerId: '', eraId: '' });
      return;
    }
    const next: Partial<EastAsianDateValues> = {
      rulerId: String(entry.rulerId),
      dynId: String(entry.dynId),
    };
    if (values.eraId) {
      const era = authority?.eras.find((e) => String(e.eraId) === values.eraId);
      if (!era || String(era.rulerId) !== String(entry.rulerId)) next.eraId = '';
    }
    patch(next);
  };

  const handleEra = (entry: EraAuthorityEntry | null) => {
    if (!entry) {
      patch({ eraId: '' });
      return;
    }
    patch({
      eraId: String(entry.eraId),
      dynId: String(entry.dynId),
      rulerId: entry.rulerId != null ? String(entry.rulerId) : values.rulerId,
    });
  };

  if (loading) {
    return (
      <Stack alignItems="center" direction="row" spacing={1} sx={{ py: 1 }}>
        <CircularProgress size={18} />
        <Typography color="text.secondary" variant="body2">
          Loading calendar tables…
        </Typography>
      </Stack>
    );
  }

  if (!authority) {
    return (
      <Typography color="text.secondary" variant="body2">
        {error ?? 'Calendar lookup is unavailable. Install sanmiao and restart the app.'}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography color="text.secondary" variant="caption">
        Calendar context (dynasty, emperor, era) — used by sanmiao when resolving dates.
      </Typography>

      <Autocomplete
        disabled={disabled}
        filterOptions={(options, state) =>
          filterDynasties(options, state.inputValue)
        }
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(a, b) => a.dynId === b.dynId}
        onChange={(_event, option) => handleDynasty(option)}
        options={dynastyOptions}
        renderInput={(params) => (
          <TextField {...params} label="Dynasty" placeholder="Type to search…" size="small" />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={optionKey('dyn', option.dynId)}>
            <ListItemText
              primary={option.label}
              secondary={dynastySubtitle(option)}
            />
          </Box>
        )}
        value={selectedDynasty}
      />

      <Autocomplete
        disabled={disabled}
        filterOptions={(_options, state) =>
          filterRulers(authority.rulers, values.dynId, state.inputValue)
        }
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(a, b) => a.rulerId === b.rulerId}
        onChange={(_event, option) => handleRuler(option)}
        options={rulerOptions}
        renderInput={(params) => (
          <TextField {...params} label="Emperor" placeholder="Type to search…" size="small" />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={optionKey('ruler', option.rulerId)}>
            <ListItemText primary={option.label} secondary={rulerSubtitle(option)} />
          </Box>
        )}
        value={selectedRuler}
      />

      <Autocomplete
        disabled={disabled}
        filterOptions={(_options, state) =>
          filterEras(authority.eras, values.dynId, values.rulerId, state.inputValue)
        }
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(a, b) => a.eraId === b.eraId}
        onChange={(_event, option) => handleEra(option)}
        options={eraOptions}
        renderInput={(params) => (
          <TextField {...params} label="Era" placeholder="Type to search…" size="small" />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={optionKey('era', option.eraId)}>
            <ListItemText primary={option.label} secondary={eraSubtitle(option)} />
          </Box>
        )}
        value={selectedEra}
      />

      <Stack direction="row" spacing={1}>
        <TextField
          disabled={disabled}
          fullWidth
          label="Year"
          onChange={(event) => patch({ year: event.target.value })}
          placeholder="元年, 3, 十八"
          size="small"
          value={values.year}
        />
        <TextField
          disabled={disabled}
          fullWidth
          label="Month"
          onChange={(event) => patch({ month: event.target.value })}
          placeholder="3, 十八"
          size="small"
          value={values.month}
        />
        <TextField
          disabled={disabled}
          fullWidth
          label="Day"
          onChange={(event) => patch({ day: event.target.value })}
          placeholder="optional"
          size="small"
          value={values.day}
        />
      </Stack>

      <Stack direction="row" spacing={1}>
        <TextField
          disabled={disabled}
          fullWidth
          label="Sexagenary year"
          onChange={(event) => patch({ sexYear: event.target.value })}
          placeholder="sex_year"
          size="small"
          value={values.sexYear}
        />
        <TextField
          disabled={disabled}
          fullWidth
          helperText="1–60, or paste 甲子"
          label="Sexagenary day"
          onChange={(event) => patch({ gz: event.target.value })}
          placeholder="gz"
          size="small"
          value={values.gz}
        />
        <TextField
          disabled={disabled}
          fullWidth
          helperText="1–60, or paste 甲子"
          label="New-moon gz"
          onChange={(event) => patch({ nmdGz: event.target.value })}
          placeholder="nmd_gz"
          size="small"
          value={values.nmdGz}
        />
      </Stack>
    </Stack>
  );
};
