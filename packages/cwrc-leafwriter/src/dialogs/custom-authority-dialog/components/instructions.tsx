import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';

export const Instructions = () => {
  return (
    <Accordion>
      <AccordionSummary
        aria-controls="instructions-content"
        expandIcon={<ExpandMoreIcon />}
        id="instructions-header"
      >
        <Typography component="span">Instructions</Typography>
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
