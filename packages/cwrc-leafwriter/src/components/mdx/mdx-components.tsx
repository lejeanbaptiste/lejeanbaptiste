import { Link, Typography } from '@mui/material';
import type { MDXComponents } from 'mdx/types';
import { slugify } from '../../utilities';

export const MdxComponents = (override?: MDXComponents): MDXComponents => {
  return {
    h1: ({ children }) => (
      <Typography
        component="h1"
        id={typeof children === 'string' ? slugify(children) : ''}
        variant="h1"
      >
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography
        component="h2"
        id={typeof children === 'string' ? slugify(children) : ''}
        variant="h2"
      >
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography
        component="h3"
        id={typeof children === 'string' ? slugify(children) : ''}
        variant="h3"
      >
        {children}
      </Typography>
    ),
    h4: ({ children }) => (
      <Typography
        component="h4"
        id={typeof children === 'string' ? slugify(children) : ''}
        variant="h4"
      >
        {children}
      </Typography>
    ),
    p: ({ children }) => <Typography variant="body1">{children}</Typography>,
    a: ({ children, ...props }) => (
      <Link rel="noopener noreferrer" target="_blank" {...(props as HTMLLinkElement['attributes'])}>
        {children}
      </Link>
    ),
    img: ({ alt, ...props }) => (
      <img
        sizes="100vw"
        style={{ width: '100%', height: 'auto' }}
        {...(props as HTMLImageElement['attributes'])}
        alt={alt ?? ''}
      />
    ),
    li: ({ children }) => (
      <Typography component="li" variant="body1">
        {children}
      </Typography>
    ),
    code: ({ children }) => (
      <Typography
        component="code"
        sx={[
          {
            borderRadius: 1,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'grey.400',
            backgroundColor: 'color-mix(in srgb, var(--mui-palette-grey-200) 80%, transparent)',
            fontFamily: 'monospace',
          },
          (theme) =>
            theme.applyStyles('dark', {
              borderColor: 'grey.600',
              backgroundColor: 'color-mix(in srgb, var(--mui-palette-grey-800) 30%, transparent)',
            }),
        ]}
        variant="body2"
      >
        {children}
      </Typography>
    ),
    abbr: ({ children, title }) => (
      <Typography component="abbr" title={title}>
        {children}
      </Typography>
    ),
    ...override,
  };
};
