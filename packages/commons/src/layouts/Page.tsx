import { useAppState } from '@src/overmind';
import React, { forwardRef } from 'react';
import { Helmet } from 'react-helmet-async';

interface PageProps {
  title?: string;
}

const PAGE_TITLE = 'LEAF-Writer Commons';

export const Page = forwardRef<PageProps, any>(({ children, title, ...rest }, ref) => {
  const { resource } = useAppState().editor;

  title = title ? title : PAGE_TITLE;
  title = resource?.filename ? `${resource.filename} - ${PAGE_TITLE}` : PAGE_TITLE;

  return (
    <div ref={ref} {...rest}>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {children}
    </div>
  );
});
