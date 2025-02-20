import { Link, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export const About = () => {
  const { breakpoints } = useTheme();

  const { currentLocale } = useAppState().ui;

  const [content, setContent] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    loadContent();
  }, [currentLocale]);

  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const loadContent = async () => {
    const response = await fetch(`./content/about/${currentLocale}.md`);
    const text = await response.text();
    setContent(text);
  };

  return (
    <ReactMarkdown
      components={{
        h1: ({ node, children }) => (
          <Typography
            component="h1"
            mb={4}
            sx={{ fontWeight: 300 }}
            variant={isMobile ? 'h3' : 'h2'}
            {...node?.properties}
          >
            {children}
          </Typography>
        ),
        h2: ({ node, children }) => (
          <Typography component="h2" mb={3} variant={isMobile ? 'h4' : 'h3'} {...node?.properties}>
            {children}
          </Typography>
        ),
        h3: ({ node, children }) => (
          <Typography
            component="h3"
            mb={2.5}
            variant={isMobile ? 'h5' : 'h4'}
            {...node?.properties}
          >
            {children}
          </Typography>
        ),
        h4: ({ node, children }) => (
          <Typography component="h4" mb={2} variant={isMobile ? 'h6' : 'h5'} {...node?.properties}>
            {children}
          </Typography>
        ),
        h5: ({ node, children }) => (
          <Typography mb={1.5} variant={isMobile ? 'subtitle1' : 'h6'} {...node?.properties}>
            {children}
          </Typography>
        ),
        h6: ({ node, children }) => (
          <Typography
            component="h6"
            mb={1}
            variant={isMobile ? 'subtitle2' : 'subtitle1'}
            sx={{ fontWeight: 700 }}
            {...node?.properties}
          >
            {children}
          </Typography>
        ),
        p: ({ node, children }) => (
          <Typography my={1} {...node?.properties}>
            {children}
          </Typography>
        ),
        a: ({ node, href, children }) => (
          <Link
            aria-label={`${children?.toString()} (opens in new window)`}
            href={href}
            underline="hover"
            target="_blank"
            rel="noopener noreferrer"
            {...node?.properties}
          >
            {children}
          </Link>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
