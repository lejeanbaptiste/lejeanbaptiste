import { db } from '@src/db';
import { useActions, useAppState } from '@src/overmind';
import type { Error, Resource } from '@src/types';
import { isErrorMessage } from '@src/types';
import { isBefore } from 'date-fns';
import Cookies from 'js-cookie';
import queryString from 'query-string';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

interface Permalink {
  error?: Error;
  isSample?: boolean;
  raw: string;
  resource?: Resource | Resource;
  valid: boolean;
}

export const usePermalink = () => {
  const { userState } = useAppState().auth;

  const { signIn } = useActions().auth;
  const { clearResource } = useActions().editor;
  const { isStorageProviderSupported } = useActions().providers;
  const { getSampleDocuments, getTemplates } = useActions().storage;

  const { t } = useTranslation('LWC');
  const location = useLocation();
  const navigate = useNavigate();

  const getLanguage = () => {
    const { lang } = queryString.parse(location.search);
    if (Array.isArray(lang)) return lang[0];
    return lang;
  };

  const getResourceFromPermalink = async () => {
    let permalink = await parsePermalink();
    if (!permalink) return;
    if (permalink && isErrorMessage(permalink)) return permalink;

    if (permalink.resource?.isLocal) return permalink.resource;

    if (userState === 'UNAUTHENTICATED' && permalink.valid) {
      Cookies.set('resource', permalink.raw, { expires: 5 / 1440 }); // 5 minutes
      signIn();
      return;
    }

    if (userState === 'AUTHENTICATED') {
      const resource = Cookies.get('resource');
      if (resource) {
        Cookies.remove('resource');
        setPermalink(resource);
        permalink = await parsePermalink(resource);

        if (isErrorMessage(permalink)) return permalink;
      }

      if (!permalink) return navigate('/', { replace: true });
      return permalink.resource;
    }
  };

  const getTemplateByTitle = async (title: string) => {
    const samples = await getTemplates();
    return samples.find((template) => template.title === title);
  };

  const getSampleByTitle = async (title: string) => {
    const samples = await getSampleDocuments();
    return samples.find((sample) => sample.title === title);
  };

  const parsePermalink = async (query?: string): Promise<Permalink | Error | null> => {
    if (!query && !location.search) return null;

    const search = queryString.parse(query || location.search);
    const response = { valid: false, raw: location.search };

    if (!search) response;

    // * if it is a template
    if (typeof search.template === 'string') {
      const document = await getTemplateByTitle(search.template);
      if (!document) {
        return {
          type: 'error',
          message: `${t('commons.template')} "${search.template}" ${t('commons.not_found')}.`,
        };
      }

      return { ...response, isSample: true, resource: document, valid: true };
    }

    // * if it is a sample
    if (typeof search.sample === 'string') {
      const document = await getSampleByTitle(search.sample);

      if (!document) {
        return {
          type: 'error',
          message: `${t('commons.sample_document')} "${search.sample}" ${t('commons.not_found')}.`,
        };
      }

      return { ...response, isSample: true, resource: document, valid: true };
    }

    // * if it was open from local device
    if (search.local === 'true' && typeof search.id === 'string') {
      const document = await db.documentRequested.get(search.id);
      if (!document) {
        return {
          type: 'error',
          message: `${t('commons.unable to load document')}: ${search.filename}`,
        };
      }

      const { expires, id, ...resource } = document;

      if (!isBefore(new Date(), document.expires)) {
        return {
          type: 'error',
          message: `${t('commons.request expired')}`,
        };
      }

      resource.isLocal = true;

      return { ...response, resource, valid: true };
    }

    // * if it is comes from a provider
    if (!search.provider || Array.isArray(search.provider)) {
      return { type: 'error', message: t('storage.warning.check_URL_structure') };
    }

    if (!isStorageProviderSupported(search.provider)) {
      return {
        type: 'error',
        message: `${t('storage.warning.storage_provider_invalid', {
          provider: search.provider,
        })}. ${t('storage.warning.check_URL_structure')}`,
      };
    }

    const { provider, owner, ownertype, repo, path, filename } = search;

    const resource: Resource = { provider };
    if (typeof owner === 'string') resource.owner = owner;
    if (typeof ownertype === 'string') resource.ownertype = ownertype;
    if (typeof repo === 'string') resource.repo = repo;
    if (typeof path === 'string') resource.path = path;
    if (typeof filename === 'string') resource.filename = filename;

    return { ...response, valid: true, resource };
  };

  const setPermalink = (value?: string | Resource) => {
    let query: string;

    if (!value) {
      clearResource();
      query = '/';
      navigate(query, { replace: true });
      return query;
    }

    if (typeof value !== 'string') {
      const params = stringifyQuery(value);
      if (!params) return;
      query = `?${params}`;
    } else {
      query = value;
    }

    if (query === '/') clearResource();

    navigate(query, { replace: true });

    return query;
  };

  const stringifyQuery = (query: Resource) => {
    const { provider, owner, ownertype, repo, path, filename } = query;
    const reducedQuery = { provider, owner, ownertype, repo, path, filename };

    const params = queryString.stringify(reducedQuery, {
      skipEmptyString: true,
      skipNull: true,
      sort: false,
    });

    if (params.length === 0) return;

    return params;
  };

  return { getLanguage, getResourceFromPermalink, parsePermalink, setPermalink, stringifyQuery };
};
