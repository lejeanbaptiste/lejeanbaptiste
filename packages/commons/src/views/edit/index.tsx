import { LoadingMask } from '@src/components';
import { useLoadResource } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Editor } from './Editor';
import { MainMenu, Meta } from './topbar';

export const EditView = () => {
  const { userState } = useAppState().auth;
  const { resource } = useAppState().editor;

  const { setReadonly } = useActions().editor;
  const { setPage } = useActions().ui;

  const location = useLocation();

  const { loadFromPermalink } = useLoadResource();

  useEffect(() => {
    const firstRoute = location.pathname.split('/')[1];
    const readOnly = firstRoute === 'view' ? true : false;

    setReadonly(readOnly);
    setPage(firstRoute);
  }, []);

  useEffect(() => {
    if (userState !== 'AUTHENTICATING') loadFromPermalink();
  }, [userState]);

  return (
    <Page>
      <TopBar Left={<MainMenu />} Meta={<Meta />} />
      {!resource ? <LoadingMask /> : <Editor />}
    </Page>
  );
};
