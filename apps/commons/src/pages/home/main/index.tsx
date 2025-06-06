import { Container, Stack, useMediaQuery, useTheme } from '@mui/material';
import { Header } from './Header';
import { SmallScreenMessage } from './SmallScreenMessage';
import { StatusBar } from './StatusBar';
import { Storage } from './storage';

export const Main = () => {
  const { breakpoints } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));
  return (
    <Container>
      <Stack gap={isMobile ? 0 : 3}>
        <Header />
        {isMobile ? (
          <SmallScreenMessage />
        ) : (
          <>
            <Storage />
            <StatusBar />
          </>
        )}
      </Stack>
    </Container>
  );
};
