import { Link, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export const About = () => {
  const { language } = useAppState().ui;

  const { breakpoints } = useTheme();

  const [content, setContent] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    loadContent();
  }, [language]);

  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const loadContent = async () => {
    const file = `about_${language.code}.md`;
    const response = await fetch(`./content/${file}`);
    const text = await response.text();
    setContent(text);
  };

  return (
    <ReactMarkdown
      components={{
        h1: ({ node, ...props }) => (
          <Typography
            component="h1"
            mb={4}
            sx={{ fontWeight: 300 }}
            variant={isMobile ? 'h3' : 'h2'}
            {...props}
          />
        ),
        h2: ({ node, ...props }) => (
          <Typography component="h2" mb={3} variant={isMobile ? 'h4' : 'h3'} {...props} />
        ),
        h3: ({ node, ...props }) => (
          <Typography component="h3" mb={2.5} variant={isMobile ? 'h5' : 'h4'} {...props} />
        ),
        h4: ({ node, ...props }) => (
          <Typography component="h4" mb={2} variant={isMobile ? 'h6' : 'h5'} {...props} />
        ),
        h5: ({ node, ...props }) => (
          <Typography mb={1.5} variant={isMobile ? 'subtitle1' : 'h6'} {...props} />
        ),
        h6: ({ node, ...props }) => (
          <Typography
            component="h6"
            mb={1}
            paragraph
            variant={isMobile ? 'subtitle2' : 'subtitle1'}
            sx={{ fontWeight: 700 }}
            {...props}
          />
        ),
        p: ({ node, ...props }) => <Typography my={1} {...props} />,
        a: ({ node, ...props }) => (
          <Link underline="hover" target="_blank" rel="noopener noreferrer" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
