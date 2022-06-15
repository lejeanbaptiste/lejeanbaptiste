import React from 'react';
import BlankLayout from './layouts/BlankLayout';
import EditView from './views/editor';
import NotFoundView from './views/error/NotFoundView';
import HomeView from './views/home';
import LinkAccounts from './views/LinkAccounts';

const routes = [
  {
    path: '/edit',
    element: <BlankLayout />,
    children: [{ index: true, element: <EditView /> }],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '404', element: <NotFoundView /> },
      { path: '/link-accounts', element: <LinkAccounts /> },
      { index: true, element: <HomeView /> },
    ],
  },
];

export default routes;
