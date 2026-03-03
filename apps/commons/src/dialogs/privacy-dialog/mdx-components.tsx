import { Typography } from '@mui/material';
import type { MDXComponents } from 'mdx/types';

export const mdxComponents: MDXComponents = {
  h1: ({ children, id }) => (
    <Typography
      component="h1"
      bgcolor="background.default"
      id={id}
      mb={2}
      minHeight={24}
      position="sticky"
      py={2}
      top={0}
      variant="h5"
      zIndex={1}
    >
      {children}
    </Typography>
  ),
  h2: ({ children, id }) => (
    <Typography component="h2" id={id} mt={1.5} variant="h6">
      {children}
    </Typography>
  ),
  h3: ({ children, id }) => (
    <Typography component="h3" fontWeight={700} id={id} mt={0.5} variant="subtitle1">
      {children}
    </Typography>
  ),
  h4: ({ children, id }) => (
    <Typography component="h4" id={id} variant="subtitle1">
      {children}
    </Typography>
  ),
  p: ({ children, id }) => (
    <Typography id={id} color="text.secondary" fontSize="0.95rem" mt={1.5} variant="body1">
      {children}
    </Typography>
  ),
  li: ({ children, id }) => (
    <Typography
      id={id}
      component="li"
      color="text.secondary"
      fontSize="0.95rem"
      mb={1.5}
      variant="body1"
    >
      {children}
    </Typography>
  ),
};
