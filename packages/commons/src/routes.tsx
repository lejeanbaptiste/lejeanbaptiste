import React from 'react';
import { BasicLayout } from './layouts';
import { EditView, HomeView, LinkAccounts, NotFoundView } from './views';

const routes = [
  {
    path: '/',
    element: <BasicLayout />,
    children: [
      { path: '404', element: <NotFoundView /> },
      { path: '/link-accounts', element: <LinkAccounts /> },
      { path: '/edit', element: <EditView /> },
      { index: true, element: <HomeView /> },
    ],
  },
];

export default routes;
