import React from 'react';
import BlankLayout from './layouts/BlankLayout';
import { EditView, HomeView, LinkAccounts, NotFoundView } from './views';

const routes = [
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '404', element: <NotFoundView /> },
      { path: '/link-accounts', element: <LinkAccounts /> },
      { path: '/edit', element: <EditView /> },
      { index: true, element: <HomeView /> },
    ],
  },
];

export default routes;
