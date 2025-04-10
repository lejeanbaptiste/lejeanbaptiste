import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const Instructions = () => {
  const { t } = useTranslation();
  return (
    <Accordion>
      <AccordionSummary
        aria-controls="instructions-content"
        expandIcon={<ExpandMoreIcon />}
        id="instructions-header"
      >
        <Typography component="span">{t('LW.commons.instructions')}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          The Authority file has to be: TEI XML file formatted in a specific way (ideally, formatted
          using established TEI practices for Authority Lists) Publicly accessible on the web
          [ideally on a Git management platform like GitHub or GitLab]
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
};
