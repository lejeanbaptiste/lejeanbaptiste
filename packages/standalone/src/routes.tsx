import React from 'react';
// import { Navigate } from 'react-router-dom';
// import AppLayout from './layouts/AppLayout';
import BlankLayout from './layouts/BlankLayout';
import NotFoundView from './views/error/NotFoundView';
import HomeView from './views/home';
import LinkAccounts from './views/LinkAccounts';

const routes = [
  // {
  //   path: '/app',
  //   element: <AppLayout />,
  //   children: [
  //     { path: '/', element: <StoriesView /> },
  //     { path: '/users', element: <UsersView /> },
  //   ],
  // },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '404', element: <NotFoundView /> },
      { path: '/link-accounts', element: <LinkAccounts /> },
      { path: '/', element: <HomeView /> },
    ],
  },
];

export default routes;
