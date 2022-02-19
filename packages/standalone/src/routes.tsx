import React from 'react';
import BlankLayout from './layouts/BlankLayout';
import NotFoundView from './views/error/NotFoundView';
import HomeView from './views/home';
import Editor from './views/edit';
import LinkAccounts from './views/LinkAccounts';

const routes = [
  {
    path: '/edit',
    element: <BlankLayout />,
    children: [{ index: true, element: <Editor /> }],
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
