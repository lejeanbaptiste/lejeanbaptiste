import { Box, Button } from '@mui/material';
import { usePermalink } from '@src/hooks/usePermalink';
import { useActions, useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import Cookies from 'js-cookie';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const SignInSection: FC = () => {

  useEffect(() => {
    if (userAuthenticated === false) {
      const permalink = parsePermalink();
      if (permalink?.valid) {
        Cookies.set('resource', permalink.raw, { expires: 5 / 1440 }); // 5 minutes
        signIn();
      }
    }
  const { userState } = useAppState().auth;
  const { signIn } = useActions().auth;

    if (userAuthenticated === true) {
      const resource = Cookies.get('resource');
      if (resource) {
        Cookies.remove('resource');
        setPermalink(resource);
      }
    }
  }, [userAuthenticated]);
  const { t } = useTranslation();

  const handleClick = () => signIn();

  const conainerVariants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  return (
    <AnimatePresence>
      {userState === 'UNAUTHENTICATED' && (
        <Box
          component={motion.div}
          variants={conainerVariants}
          initial="initial"
          animate="visible"
          exit="exit"
          display="flex"
          justifyContent="center"
          py={6}
        >
          <Button onClick={handleClick} size="large" variant="contained" sx={{ width: 150 }}>
            {t('home:signin')}
          </Button>
        </Box>
      )}
    </AnimatePresence>
  );
};

export default SignInSection;
