import { db } from '@src/db';
import { useAppState } from '@src/overmind';
import type { DocumentRequested, Resource } from '@src/types';
import { add } from 'date-fns';
import queryString from 'query-string';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { usePermalink } from './usePermalink';

interface ResourceMeta {
  category: 'sample' | 'template';
  title: string;
}

interface OpenResourceProps {
  resource: Resource;
  meta?: ResourceMeta;
}

const OPEN_NEW_TABS_FROM_PAGES = ['edit', 'view'];

export const useOpenResource = () => {
  const { page } = useAppState().ui;

  const navigate = useNavigate();

  const { stringifyQuery } = usePermalink();

  const openResource = async ({ resource }: OpenResourceProps) => {
    return resource.provider
      ? openResourceFromProvider(resource)
      : await openLocalResource(resource);
  };

  const openLocalResource = async (resource: Resource) => {
    const { content, filename } = resource;
    const expires = add(new Date(), { minutes: 5 });
    const id = uuidv4();

    const documentRequested: DocumentRequested = { content, filename, expires, id };
    await db.documentRequested.add(documentRequested);

    const params = queryString.stringify(
      { filename, id, local: true },
      { skipEmptyString: true, skipNull: true, sort: false },
    );

    open(`/edit?${params}`);
  };

  const openResourceFromProvider = async (resource: Resource) => {
    const params = stringifyQuery(resource);
    const route = resource.writePermission === false ? 'view' : 'edit';

    open(`/${route}?${params}`);
  };

  const openFromLibrary = async ({ category, title }: ResourceMeta) => {
    open(`/edit?${category}=${title}`);
  };

  const open = (route: string) => {
    if (OPEN_NEW_TABS_FROM_PAGES.includes(page)) {
      const url = `${window.location.origin}${route}`;
      window.open(url, '_blank');
      return;
    }
    navigate(route, { replace: true });
  };

  return {
    openResource,
    openFromLibrary,
  };
};
