import type { Resource } from '@cwrc/leafwriter-storage-service';
import { useActions, useAppState } from '@src/overmind';
import Cookies from 'js-cookie';
import queryString from 'query-string';
import { useLocation, useNavigate } from 'react-router-dom';

interface Permalink {
  error?: string;
  raw: string;
  resource?: Resource;
  valid: boolean;
}

export const usePermalink = () => {
  const { userState } = useAppState().auth;

  const { signIn } = useActions().auth;
  const { clearResource, isStorageProviderSupported } = useActions().storage;

  const location = useLocation();
  const navigate = useNavigate();

  const parsePermalink = (query?: string): Permalink | null => {
    if (!query && !location.search) return null;

    const search = queryString.parse(query || location.search);
    const response = { valid: false, raw: location.search };

    if (!search) response;

    if (!search.provider || Array.isArray(search.provider)) {
      return { ...response, error: 'Invalid request. Check URL structure.' };
    }

    if (!isStorageProviderSupported(search.provider)) {
      return {
        ...response,
        error: `
          Leaf Writer could not retrieve the requested resource.
          Storage provider '${search.provider}' is not supported or is invalid.
          Check URL structure.
        `,
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

  const getResourceFromPermalink = () => {
    let permalink = parsePermalink();

    if (userState === 'UNAUTHENTICATED' && permalink?.valid) {
      Cookies.set('resource', permalink.raw, { expires: 5 / 1440 }); // 5 minutes
      signIn();
      return;
    }

    if (userState === 'AUTHENTICATED') {
      const resource = Cookies.get('resource');
      if (resource) {
        Cookies.remove('resource');
        setPermalink(resource);
        permalink = parsePermalink(resource);
      }

      if (!permalink) return navigate('/', { replace: true }); //return;

      return permalink.resource;
    }
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

  return { getResourceFromPermalink, parsePermalink, setPermalink };
};
