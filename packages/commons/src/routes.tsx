import React from 'react';
import BlankLayout from './layouts/BlankLayout';
import NotFoundView from './views/Error/NotFoundView';
import HomeView from './views/Home';
import EditView from './views/Editor';
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
