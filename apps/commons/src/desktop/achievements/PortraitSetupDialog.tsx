import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  BODY_TYPES,
  EARRINGS_VARIANTS,
  EYEBROW_VARIANTS,
  EYE_VARIANTS,
  FEATURES_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_COLORS,
  HAIR_VARIANTS,
  MOUTH_VARIANTS,
  SKIN_COLORS,
  diceBearAvatarUrl,
  type DiceBearAvatarOptions,
} from './dicebear';
import { avatarSelectMenuProps } from './avatarSelectMenuProps';

const Field = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <Stack spacing={0.5} sx={{ minWidth: 140 }}>
    <Typography color="text.secondary" variant="caption">
      {label}
    </Typography>
    {children}
  </Stack>
);

interface PortraitSetupDialogProps {
  onChange: (changes: Partial<DiceBearAvatarOptions>) => void;
  onFinish: () => void;
  open: boolean;
  options: DiceBearAvatarOptions;
}

/** First-run portrait picker. It intentionally uses no Service Record language. */
export const PortraitSetupDialog = ({
  onChange,
  onFinish,
  open,
  options,
}: PortraitSetupDialogProps) => {
  const { t } = useTranslation();
  const selectProps = { MenuProps: avatarSelectMenuProps, size: 'small' as const };
  const variant = (number: string) => t('LWC.desktop.portrait_setup.variant', { number });

  return (
    <Dialog disableEscapeKeyDown fullWidth maxWidth="md" open={open}>
      <DialogTitle>{t('LWC.desktop.portrait_setup.title')}</DialogTitle>
      <DialogContent>
        <Stack
          alignItems="flex-start"
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          sx={{ pt: 1 }}
        >
          <Box
            alt=""
            component="img"
            src={diceBearAvatarUrl(options, { closeUp: true })}
            sx={{ height: 'auto', maxWidth: '100%', width: { md: 512, xs: 360 } }}
          />
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Stack direction="row" flexWrap="wrap" gap={1.5}>
              <Field label={t('LWC.desktop.portrait_setup.body_type')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.body_type')}
                    value={options.bodyType}
                    onChange={(event) => onChange({ bodyType: event.target.value as 'm' | 'f' })}
                  >
                    {BODY_TYPES.map((bodyType) => (
                      <MenuItem key={bodyType.value} value={bodyType.value}>
                        {bodyType.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.hair')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.hair')}
                    value={options.hairVariant}
                    onChange={(event) => onChange({ hairVariant: event.target.value })}
                  >
                    {HAIR_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {t(
                          `LWC.desktop.portrait_setup.hair_${item.startsWith('long') ? 'long' : 'short'}`,
                          {
                            number: item.slice(-2),
                          },
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.hair_color')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.hair_color')}
                    value={options.hairColor}
                    onChange={(event) => onChange({ hairColor: event.target.value })}
                  >
                    {HAIR_COLORS.map((color) => (
                      <MenuItem key={color.value} value={color.value}>
                        {t(`LWC.desktop.portrait_setup.hair_color_${color.value}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.complexion')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.complexion')}
                    value={options.skinColor}
                    onChange={(event) => onChange({ skinColor: event.target.value })}
                  >
                    {SKIN_COLORS.map((color) => (
                      <MenuItem key={color.value} value={color.value}>
                        {t(`LWC.desktop.portrait_setup.complexion_${color.value}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.eyes')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.eyes')}
                    value={options.eyesVariant}
                    onChange={(event) => onChange({ eyesVariant: event.target.value })}
                  >
                    {EYE_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {variant(item.slice(-2))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.eyebrows')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.eyebrows')}
                    value={options.eyebrowsVariant}
                    onChange={(event) => onChange({ eyebrowsVariant: event.target.value })}
                  >
                    {EYEBROW_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {variant(item.slice(-2))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.mouth')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.mouth')}
                    value={options.mouthVariant}
                    onChange={(event) => onChange({ mouthVariant: event.target.value })}
                  >
                    {MOUTH_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {variant(item.slice(-2))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.features')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.features')}
                    value={options.featuresProbability ? options.featuresVariant : 'none'}
                    onChange={(event) =>
                      onChange(
                        event.target.value === 'none'
                          ? { featuresProbability: 0 }
                          : { featuresVariant: event.target.value, featuresProbability: 100 },
                      )
                    }
                  >
                    <MenuItem value="none">{t('LWC.desktop.portrait_setup.none')}</MenuItem>
                    {FEATURES_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {variant(item.slice(-2))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.eyewear')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.eyewear')}
                    value={options.glassesProbability ? options.glassesVariant : 'none'}
                    onChange={(event) =>
                      onChange(
                        event.target.value === 'none'
                          ? { glassesProbability: 0 }
                          : { glassesVariant: event.target.value, glassesProbability: 100 },
                      )
                    }
                  >
                    <MenuItem value="none">{t('LWC.desktop.portrait_setup.none')}</MenuItem>
                    {GLASSES_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {variant(item.slice(-2))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
              <Field label={t('LWC.desktop.portrait_setup.earrings')}>
                <FormControl>
                  <Select
                    {...selectProps}
                    aria-label={t('LWC.desktop.portrait_setup.earrings')}
                    value={options.earringsProbability ? options.earringsVariant : 'none'}
                    onChange={(event) =>
                      onChange(
                        event.target.value === 'none'
                          ? { earringsProbability: 0 }
                          : { earringsVariant: event.target.value, earringsProbability: 100 },
                      )
                    }
                  >
                    <MenuItem value="none">{t('LWC.desktop.portrait_setup.none')}</MenuItem>
                    {EARRINGS_VARIANTS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {variant(item.slice(-2))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Field>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFinish} variant="contained">
          {t('LWC.desktop.portrait_setup.continue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
