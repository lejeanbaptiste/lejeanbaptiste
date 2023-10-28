import { db } from '@src/db';
import { useActions, useAppState } from '@src/overmind';
import type { Error, Resource } from '@src/types';
import { isErrorMessage } from '@src/types';
import { isBefore } from 'date-fns';
import Cookies from 'js-cookie';
//@ts-ignore
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
      if (permalink.isSample) return permalink.resource;

      // Get RAW URL if user is not signed in.
      if (!!permalink.resource) {
        const { owner, repo, path, filename } = permalink.resource;
        if (owner && repo && filename) {
          const _path = path ? `${path}/` : '';
          const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${_path}${filename}`;
          permalink.resource.url = encodeURI(url);
          return permalink.resource;
        }
      }

      //Redirect user to sign in.
      Cookies.set('resource', permalink.raw, { expires: 5 / 1440 }); // 5 minutes
      signIn();

      const error: Error = { type: 'warning', message: 'You must sign in to access this resource' };
      return error;
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
    if (samples instanceof Error) return;
    return samples.find((template) => template.title === title);
  };

  const getSampleByTitle = async (title: string) => {
    const samples = await getSampleDocuments();
    if (samples instanceof Error) return;
    return samples.find((sample) => sample.title === title);
  };

  const parsePermalink = async (query?: string) => {
    if (!query && !location.search) return null;

    const search = queryString.parse(query || location.search);
    const permalinkQuery: Permalink = { valid: false, raw: location.search };
    if (!search) return permalinkQuery;

    // * if it is a template
    if (typeof search.template === 'string') {
      const document = await getTemplateByTitle(search.template);
      if (!document) {
        const error: Error = {
          type: 'error',
          message: `${t('LWC:commons.template')} "${search.template}" ${t(
            'LWC:commons.not_found',
          )}.`,
        };
        return error;
      }

      const permalink: Permalink = {
        ...permalinkQuery,
        isSample: true,
        resource: document,
        valid: true,
      };
      return permalink;
    }

    // * if it is a sample
    if (typeof search.sample === 'string') {
      const document = await getSampleByTitle(search.sample);

      if (!document) {
        const error: Error = {
          type: 'error',
          message: `${t('LWC:commons.sample_document')} "${search.sample}" ${t(
            'LWC:commons.not_found',
          )}.`,
        };
        return error;
      }

      const permalink: Permalink = {
        ...permalinkQuery,
        isSample: true,
        resource: document,
        valid: true,
      };
      return permalink;
    }

    // * if it was open from local device
    if (search.local === 'true' && typeof search.id === 'string') {
      const document = await db.documentRequested.get(search.id);
      if (!document) {
        const error: Error = {
          type: 'error',
          message: `${t('LWC:commons.unable to load document')}: ${search.filename}`,
        };
        return error;
      }

      const { expires, id, ...resource } = document;

      if (!isBefore(new Date(), document.expires)) {
        const error: Error = { type: 'error', message: `${t('LWC:commons.request expired')}` };
        return error;
      }

      resource.isLocal = true;

      const permalink: Permalink = { ...permalinkQuery, resource, valid: true };
      return permalink;
    }

    // * if it is comes from a provider
    if (!search.provider || Array.isArray(search.provider)) {
      const error: Error = { type: 'error', message: t('LWC:storage.warning.check_URL_structure') };
      return error;
    }

    if (!isStorageProviderSupported(search.provider)) {
      const error: Error = {
        type: 'error',
        message: `${t('LWC:storage.warning.storage_provider_invalid', {
          provider: search.provider,
        })}. ${t('LWC:storage.warning.check_URL_structure')}`,
      };
      return error;
    }

    const { provider, owner, ownertype, repo, path, filename } = search;

    const resource: Resource = { provider };
    if (typeof owner === 'string') resource.owner = owner;
    if (typeof ownertype === 'string') resource.ownertype = ownertype;
    if (typeof repo === 'string') resource.repo = repo;
    if (typeof path === 'string') resource.path = path;
    if (typeof filename === 'string') resource.filename = filename;

    const permalink: Permalink = { ...permalinkQuery, valid: true, resource };
    return permalink;
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
