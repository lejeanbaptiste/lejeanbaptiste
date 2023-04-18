import React from 'react';
import { BasicLayout } from './layouts';
import { EditPage, HomePage, LinkAccountsPage, NotFoundPage } from './pages';

export const routes = [
  {
    path: '/',
    element: <BasicLayout />,
    children: [
      { path: '404', element: <NotFoundPage /> },
      { path: '/link-accounts', element: <LinkAccountsPage /> },
      { path: '/edit', element: <EditPage /> },
      { path: '/view', element: <EditPage /> },
      { index: true, element: <HomePage /> },
    ],
  },
];
