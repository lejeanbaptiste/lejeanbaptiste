import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Box, FormControl, Icon, MenuItem, Stack, SvgIconTypeMap, Typography } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useActions, useAppState } from '@src/overmind';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

type Options = {
  label: string;
  value: string;
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string };
};

export const EditorModeSelector = () => {
  const { readonly } = useAppState().editor;
  const { setReadonly } = useActions().editor;

  const navigate = useNavigate();
  const location = useLocation();

  const { t } = useTranslation();

  const [mode, setMode] = useState('');

  useEffect(() => {
    const selection = readonly ? 'viewing' : 'editing';
    setMode(selection);
  }, []);

  const handleChange = (event: SelectChangeEvent) => {
    setMode(event.target.value);
    const isReadonly = event.target.value === 'editing' ? false : true;
    setReadonly(isReadonly);

    const route = isReadonly ? 'view' : 'edit';
    navigate(`/${route}${location.search}`, { replace: true });
  };

  const options: Options[] = [
    { label: t('LWC.commons.viewing'), value: 'viewing', icon: VisibilityIcon },
    { label: t('LWC.commons.editing'), value: 'editing', icon: EditIcon },
  ];

  return (
    <FormControl sx={{ mx: 1, minWidth: 115 }} size="small">
      <Select
        onChange={handleChange}
        sx={{
          borderRadius: 1.5,
          height: 24,
          pb: 0.25,
        }}
        value={mode}
      >
        {options.map(({ label, value, icon }) => (
          <MenuItem
            key={label}
            dense
            value={value}
            sx={{ mx: 0.5, px: 0.75, borderRadius: 1, my: 0.5 }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              width="100%"
              gap={1.5}
            >
              <Icon component={icon} sx={{ width: 14, height: 14, pt: 0.25 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption">{label}</Typography>
              </Box>
            </Stack>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
