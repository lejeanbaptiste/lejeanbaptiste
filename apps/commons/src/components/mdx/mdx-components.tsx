import { Link, Typography } from '@mui/material';
import type { MDXComponents } from 'mdx/types';

export const MdxComponents = (override?: MDXComponents): MDXComponents => {
  return {
    h1: ({ children, id }) => (
      <Typography component="h1" id={id} mb={3} variant="h1">
        {children}
      </Typography>
    ),
    h2: ({ children, id }) => (
      <Typography component="h2" id={id} my={2} variant="h2">
        {children}
      </Typography>
    ),
    h3: ({ children, id }) => (
      <Typography component="h3" id={id} my={1} variant="h3">
        {children}
      </Typography>
    ),
    h4: ({ children, id }) => (
      <Typography component="h4" id={id} variant="h4">
        {children}
      </Typography>
    ),
    p: ({ children, id }) => (
      <Typography id={id} mt={1} variant="body1">
        {children}
      </Typography>
    ),
    a: ({ children, ...props }) => (
      <Link
        aria-label={`${children?.toString()} (opens in new window)`}
        rel="noopener noreferrer"
        target="_blank"
        {...(props as HTMLLinkElement['attributes'])}
      >
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
    li: ({ children, id }) => (
      <Typography id={id} component="li" variant="body1">
        {children}
      </Typography>
    ),
    code: ({ children, id }) => (
      <Typography
        id={id}
        component="code"
        mr="1px"
        px={0.5}
        borderRadius={1}
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
    abbr: ({ children, title, id }) => (
      <Typography id={id} component="abbr" title={title}>
        {children}
      </Typography>
    ),
    ...override,
  };
};
