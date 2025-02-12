import SearchIcon from '@mui/icons-material/Search';
import { Box, CircularProgress, IconButton, InputAdornment, OutlinedInput } from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import { authoritiesAtom, lookupsBeenFetchedAtom, lookupTypeAtom, queryAtom } from './store';
import { useEntityLookup } from './useEntityLookup';

export const QueryField = () => {
  const authorities = useAtomValue(authoritiesAtom);
  const lookupsBeenFetched = useAtomValue(lookupsBeenFetchedAtom);
  const lookupType = useAtomValue(lookupTypeAtom);
  const [query, setQuery] = useAtom(queryAtom);

  const { search } = useEntityLookup();

  return (
    <Box px={6} pb={3}>
      <OutlinedInput
        endAdornment={
          <InputAdornment position="end">
            {lookupsBeenFetched > 0 ? (
              <CircularProgress
                size={16}
                value={((authorities.length - lookupsBeenFetched) / authorities.length) * 100}
                variant="determinate"
              />
            ) : (
              <IconButton
                aria-label="trigger-search"
                onClick={() => query && search({ query, type: lookupType })}
                size="small"
              >
                <SearchIcon />
              </IconButton>
            )}
          </InputAdornment>
        }
        fullWidth
        id="query"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) =>
          event.code === 'Enter' && query && search({ query, type: lookupType })
        }
        size="small"
        value={query}
      />
    </Box>
  );
};
