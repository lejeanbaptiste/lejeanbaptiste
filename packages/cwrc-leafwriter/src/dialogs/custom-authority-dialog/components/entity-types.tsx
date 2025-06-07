import {
  Box,
  Button,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  OutlinedInput,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { FieldArray, useField } from 'formik';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiError } from 'react-icons/bi';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { RxExternalLink } from 'react-icons/rx';
import z from 'zod';
import { Icon } from '../../../icons';
import { namedEntityTypes, type EntityTypeProps, type NamedEntityType } from '../../../types';
import { capitalizeString } from '../../../utilities';

const DISALLOWED_TYPES: NamedEntityType[] = ['thing', 'concept', 'citation'];

export const EntityTypes = () => {
  const { t } = useTranslation();
  const [fieldCollection, meta, helpers] = useField<EntityTypeProps[]>('entityTypes');
  const { setError } = helpers;

  return (
    <Box>
      <Typography
        borderBottom="1px solid"
        pb={0.5}
        mb={1}
        sx={{ textTransform: 'capitalize' }}
        variant="subtitle1"
      >
        {t('LW.commons.entity types')}
      </Typography>
      <FieldArray name="entityTypes">
        {({ push, remove, replace }) => (
          <>
            {fieldCollection.value.map(({ name, url }, index) => (
              //@ts-ignore - type mismatch
              <EntityType
                key={name}
                {...{
                  index,
                  //@ts-ignore - type mismatch
                  errorUrl: meta.error?.[index]?.url,
                  name,
                  url,
                  remove,
                  replace,
                  setError,
                  touched: meta.touched,
                }}
              />
            ))}
            <AddEntityType onChange={push} />
          </>
        )}
      </FieldArray>
      <Box minHeight={27} pl={2}>
        {meta.touched && meta.error && (
          <FormHelperText error required sx={{ mt: 0 }}>
            {typeof meta.error === 'string' && meta.error}
          </FormHelperText>
        )}
      </Box>
    </Box>
  );
};

const urlValidator = z.string().url().startsWith('https://');

const EntityType = ({
  errorUrl,
  index,
  name,
  remove,
  replace,
  setError,
  touched,
  url,
}: EntityTypeProps & {
  errorUrl?: string;
  index: number;
  remove: (index: number) => void;
  replace: (index: number, value: EntityTypeProps) => void;
  setError: (value: string | undefined | { [index: number]: { url: string } }) => void;
  touched: boolean;
}) => {
  const { t } = useTranslation();

  const [isValidUrl, setIsValidUrl] = useState(true);

  const isValidHttps = (url: string) => urlValidator.safeParse(url).success;

  const testURL = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        setError({ [index]: { url: t('LW.messages.url invalid') } });
        setIsValidUrl(false);
        return false;
      }

      const data = await response.text();
      const doc = new DOMParser().parseFromString(data, 'application/xml');
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        setError({ [index]: { url: t('LW.xml_document_invalid') } });
        setIsValidUrl(false);
        return false;
      }

      setIsValidUrl(true);
      setError(undefined);
      return true;
    } catch (error) {
      setError({ [index]: { url: t('LW.messages.failed to fetch URL') } });
      setIsValidUrl(false);
      return false;
    }
  };

  return (
    <Grid
      container
      spacing={2}
      borderRadius={1}
      my={0.5}
      py={0.75}
      px={1}
      sx={[
        {
          transition: 'all 0.4s ease',
          '&:focus-within': { backgroundColor: 'action.hover' },
          '&:hover': { backgroundColor: 'action.hover' },
        },
      ]}
    >
      <Grid size={3}>
        <Stack direction="row" gap={1} sx={{ m: 1, width: 148 }}>
          <Icon name={name} sx={{ height: 18, width: 18 }} />
          <Typography variant="body1">{capitalizeString(t(`LW.entity.${name}`))}</Typography>
        </Stack>
      </Grid>
      <Grid size={9}>
        <Stack>
          <Stack direction="row" gap={1}>
            <OutlinedInput
              autoComplete=""
              error={touched && Boolean(errorUrl)}
              id="url"
              margin="dense"
              name="url"
              onChange={(event) => {
                replace(index, { name, url: event.target.value });
                setIsValidUrl(true);
              }}
              onBlur={async (event) => {
                replace(index, { name, url: event.target.value });
                await testURL(event.target.value);
              }}
              placeholder="URL"
              required
              size="small"
              endAdornment={
                url &&
                url !== '' && (
                  <InputAdornment position="end" sx={{ gap: 1 }}>
                    {!isValidUrl && <BiError />}
                    <IconButton
                      aria-label={t('LW.messages.navigate to url')}
                      color="primary"
                      disabled={!isValidHttps(url)}
                      edge="end"
                      href={url}
                      size="small"
                      sx={{ borderRadius: 1, transition: 'all 0.4s ease' }}
                      target="_blank"
                    >
                      <RxExternalLink />
                    </IconButton>
                  </InputAdornment>
                )
              }
              sx={{ width: 360 }}
              type="text"
              value={url ?? ''}
            />
            <Tooltip title={t('LW.commons.delete')}>
              <IconButton onClick={() => remove(index)} size="small" sx={{ borderRadius: 1 }}>
                <Icon name="delete" fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box minHeight={24} pl={2}>
            {touched && errorUrl && (
              <FormHelperText error required>
                {errorUrl}
              </FormHelperText>
            )}
          </Box>
        </Stack>
      </Grid>
    </Grid>
  );
};

export const AddEntityType = ({ onChange }: { onChange: (type: EntityTypeProps) => void }) => {
  const { t } = useTranslation();
  const [field] = useField<EntityTypeProps[]>('entityTypes');

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = !!anchorEl;

  const availableTypes = namedEntityTypes.filter((type) => {
    return (
      !DISALLOWED_TYPES.includes(type) &&
      !field.value.some((entityType) => entityType.name === type)
    );
  });

  const addType = (type: NamedEntityType) => {
    onChange({ name: type });
    setAnchorEl(null);
  };

  return (
    <>
      {availableTypes.length > 0 && (
        <Box>
          <Button
            aria-controls={open ? 'entity-type-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            disableElevation
            endIcon={<MdKeyboardArrowDown />}
            fullWidth
            id="add-entity-type"
            onClick={(event) => setAnchorEl(event.currentTarget)}
            size="small"
            variant="outlined"
          >
            Add Entity Type
          </Button>
          <Menu
            anchorEl={anchorEl}
            anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
            id="entity-type-menu"
            onClose={() => setAnchorEl(null)}
            open={open}
            slotProps={{
              list: { 'aria-labelledby': 'add-entity-type' },
            }}
            sx={{ minWidth: 154 }}
            transformOrigin={{ horizontal: 'center', vertical: 'top' }}
          >
            {availableTypes.map((type) => (
              <MenuItem dense key={type} onClick={() => addType(type)} sx={{ minWidth: 154 }}>
                {capitalizeString(t(`LW.entity.${type}`))}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}
    </>
  );
};
