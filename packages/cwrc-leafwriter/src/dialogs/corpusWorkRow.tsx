import { Box, ListItemText, Typography } from '@mui/material';

export interface CorpusWorkRowProps {
  /** Section of the canon: 正統道藏洞真部本文類, 經部・易類. */
  section?: string;
  /** Work identifier shown before the title: DZ 3, KR1a0030. */
  ident?: string;
  title: string;
  /** Title as filed, where it differs from the canonical one and disambiguates. */
  fileTitle?: string;
  dynasty?: string;
  authors?: string;
}

/**
 * One work in a corpus search list: section, identifier, title, then dynasty and
 * authors. Shared so the Daozang and Kanripo windows read the same way.
 */
export const CorpusWorkRow = ({
  section,
  ident,
  title,
  fileTitle,
  dynasty,
  authors,
}: CorpusWorkRowProps) => (
  <ListItemText
    disableTypography
    primary={
      <>
        {section && (
          <Typography variant="caption" color="text.secondary" display="block">
            {section}
          </Typography>
        )}
        <Typography variant="body2">
          {ident && (
            <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
              {ident}
            </Box>
          )}
          {title}
          {fileTitle && (
            <Box component="span" sx={{ color: 'text.secondary', ml: 1 }}>
              〔{fileTitle}〕
            </Box>
          )}
        </Typography>
        {(dynasty || authors) && (
          <Typography variant="caption" color="text.secondary" display="block">
            {[dynasty, authors].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </>
    }
  />
);
