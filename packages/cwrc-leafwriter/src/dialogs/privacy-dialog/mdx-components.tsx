import { Typography } from '@mui/material';
import type { MDXComponents } from 'mdx/types';
import { slugify } from '../../utilities';

export const mdxComponents: MDXComponents = {
  h1: ({ children }) => (
    <Typography
      component="h1"
      bgcolor="background.default"
      id={typeof children === 'string' ? slugify(children) : ''}
      mb={2}
      minHeight={24}
      position="sticky"
      py={2}
      variant="h5"
      top={0}
      zIndex={1}
    >
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography
      component="h2"
      id={typeof children === 'string' ? slugify(children) : ''}
      mt={1.5}
      variant="h6"
    >
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography
      component="h3"
      fontWeight={700}
      id={typeof children === 'string' ? slugify(children) : ''}
      mt={0.5}
      variant="subtitle1"
    >
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography
      component="h4"
      id={typeof children === 'string' ? slugify(children) : ''}
      variant="subtitle1"
    >
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography color="text.secondary" fontSize="0.95rem" mt={1.5} variant="body1">
      {children}
    </Typography>
  ),
  li: ({ children }) => (
    <Typography component="li" color="text.secondary" fontSize="0.95rem" mb={1.5} variant="body1">
      {children}
    </Typography>
  ),
};
