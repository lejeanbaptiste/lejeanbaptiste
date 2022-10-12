import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { StorageProviderName } from '@src/services';
import type { Resource } from '@src/types';
import React, { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router';
import { RecentFileCard } from './RecentFileCard';

interface RecentViewProps {
  height?: number;
}

export const RecentView: FC<RecentViewProps> = () => {
  const { recentDocuments } = useAppState().storage;
  const { getStorageProviderAuth, loadRecentFiles, removeRecentDocument, setResource } =
    useActions().storage;

  const navigate = useNavigate();

  const { setPermalink } = usePermalink();

  const [recents, setRecents] = useState<Resource[]>([]);

  useEffect(() => {
    loadRecents();
  }, []);

  useEffect(() => {
    if (recentDocuments) setRecents(recentDocuments);
  }, [recentDocuments]);

  const loadRecents = async () => {
    const documents = recentDocuments ? recentDocuments : await loadRecentFiles();
    setRecents(documents);
  };

  const load = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider as StorageProviderName);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    const permalink = setPermalink(document);
    navigate(`/edit${permalink}`, { replace: true });
  };

  const removeItem = (url: string) => removeRecentDocument(url);

  return (
    <>
      {recents.map((resource) => (
        <RecentFileCard key={resource.url} resource={resource} onClick={load} onRemove={removeItem}/>
      ))}
    </>
  );
};
