import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionSummary } from '@mui/material';
import { useState } from 'react';
import { type AuthorityService } from '../../../../types';
import { Content } from './content';
import { Header } from './header';
import { useLookupServicePrefeneces } from './useLookupEntity';

export const Authority = ({ authorityService }: { authorityService: AuthorityService }) => {
  const { description, id, name, url, isCustom, isLocal, author } = authorityService;

  const { toggleAuthority } = useLookupServicePrefeneces();

  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    //if click on the toggle button, do not start open the panel. Toggle the authority instead.
    if ((event.target as HTMLElement).id === `switch-${id}`) {
      toggleAuthority(id);
      return;
    }

    //if click on the toggle button, do not start open the panel. Toggle the authority instead.
    if ((event.target as HTMLElement).id === `edit-${id}`) {
      //TODO - open edit dialog
      return;
    }

    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Accordion
      expanded={expanded === `panel-${id}`}
      onChange={handleChange(`panel-${id}`)}
      sx={[
        {
          position: 'inherit',
          backgroundImage: 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: 'transparent',
          boxShadow: 'none',
        },
        !expanded && {
          ':hover': { backgroundColor: (theme) => theme.vars.palette.action.hover },
        },
        !!expanded && {
          backgroundImage: 'var(--Paper-overlay)',
          backgroundColor: 'var(--mui-overlays-8)',
          boxShadow: (theme) => theme.vars.shadows[2],
        },
      ]}
    >
      <AccordionSummary
        aria-controls={`panel-${id}-content`}
        expandIcon={<ExpandMoreIcon />}
        id={`panel-${id}-header`}
        sx={{ span: { justifyContent: 'space-between' } }}
      >
        <Header expanded={!!expanded} {...{ id, isLocal, name }} />
      </AccordionSummary>
      <Content {...{ author, description, id, isCustom, isLocal, url }} />
    </Accordion>
  );
};
