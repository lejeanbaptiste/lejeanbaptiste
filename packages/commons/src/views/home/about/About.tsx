import { Link, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import React, { FC, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const About: FC = () => {
  const [content, setContent] = useState('');
  const { language } = useAppState();

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    loadContent();
  }, [language]);

  const loadContent = async () => {
    const file = `about_${language.code}.md`;
    const response = await fetch(`./content/${file}`);
    const text = await response.text();
    setContent(text);
  };

  return (
    <ReactMarkdown
      components={{
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        h1: ({ node, ...props }) => (
          //@ts-ignore
          <Typography component="h3" mb={3} sx={{ fontWeight: 300 }} variant="h4" {...props} />
        ),
        //@ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        p: ({ node, ...props }) => <Typography my={2} {...props} />,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        a: ({ node, ...props }) => (
          //@ts-ignore
          <Link underline="hover" target="_blank" rel="noopener noreferrer" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default About;
