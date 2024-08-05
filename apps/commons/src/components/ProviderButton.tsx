import { Button, Tooltip, type ButtonProps, type TooltipProps } from '@mui/material';
import { getIcon, type IconName } from '@src/icons';
import { useActions, useAppState } from '@src/overmind';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface ProviderButtonProps extends Omit<ButtonProps, 'onPointerDown'> {
  providerId?: string;
  tooltipProps?: Omit<TooltipProps, 'title'>;
}

export const ProviderButton = ({ providerId, tooltipProps, ...props }: ProviderButtonProps) => {
  const { cookieConsent } = useAppState().ui;
  const { signIn } = useActions().auth;

  const { t } = useTranslation();

  const Icon = getIcon(providerId as IconName);

  const handleButtonPointerDown = () => {
    signIn({ idpHint: providerId });
  };

  return (
    <Tooltip
      title={
        !cookieConsent.includes('interaction')
          ? t('LWC.cookie_consent.warning.must_accept_cookies_message')
          : ''
      }
      {...tooltipProps}
    >
      <span>
        <Button
          color="primary"
          disabled={!cookieConsent.includes('interaction')}
          fullWidth
          onPointerDown={handleButtonPointerDown}
          size="large"
          startIcon={<Icon />}
          variant="contained"
          sx={{ width: 140, textTransform: 'capitalize' }}
          component={motion.button}
          whileTap={{ scale: 0.95 }}
          {...props}
        >
          {providerId}
        </Button>
      </span>
    </Tooltip>
  );
};
