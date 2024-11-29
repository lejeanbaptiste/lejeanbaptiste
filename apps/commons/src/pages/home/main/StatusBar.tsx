import { Chip, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const StatusBar = () => {
  const { t } = useTranslation();

  const handleClick = () => {
    window.open(
      `mailto:contact-project+calincs-cwrc-leaf-writer-leaf-writer-31283590-issue-@incoming.gitlab.com?body=%3C%21---%20Provide%20a%20concise%20but%20specific%20and%20meaningful%20summary%20of%20the%20issue%20in%20the%20%2A%2Aemail%20subject%2A%2A%20--%3E%0A%0A%3Ch2%3EExpected%20Behaviour%3C%2Fh2%3E%0A%0A%3C%21---%20If%20you%27re%20describing%20a%20bug%2C%20tell%20us%20what%20should%20happen%20--%3E%0A%3C%21---%20If%20you%27re%20suggesting%20a%20change%2Fimprovement%2C%20tell%20us%20how%20it%20should%20work%20--%3E%0A%0A%3Ch2%3ECurrent%20Behaviour%3C%2Fh2%3E%0A%0A%3C%21---%20If%20describing%20a%20bug%2C%20tell%20us%20what%20happens%20instead%20of%20the%20expected%20behaviour%20--%3E%0A%3C%21---%20If%20suggesting%20a%20change%2Fimprovement%2C%20explain%20the%20difference%20from%20current%20behaviour%20--%3E%0A%0A%3Ch2%3EPossible%20Solution%3C%2Fh2%3E%0A%0A%3C%21---%20Not%20obligatory%2C%20but%20suggest%20a%20fix%2Freason%20for%20the%20bug%2C%20--%3E%0A%3C%21---%20or%20suggestions%20on%20how%20to%20implement%20the%20addition%20or%20change%20--%3E%0A%0A%3Ch2%3ESteps%20to%20Reproduce%20%28for%20bugs%29%3C%2Fh2%3E%0A%0A%3C%21---%20Provide%20an%20unambiguous%20set%20of%20steps%20to%20--%3E%0A%3C%21---%20reproduce%20this%20bug.%20%20Screenshots%20are%20invaluable.%20%20--%3E%0A%3C%21---%20Links%20to%20screen%20videos%20or%20brief%20.gif%20files%20can%20help%20a%20lot%20too.%20%20%20--%3E%0A%0A1.%0A2.%0A3.%0A4.%0A%0A%3Ch2%3EYour%20Environment%3C%2Fh2%3E%0A%0A-%20URL%3A%0A%0A-%20Browser%20Name%3A%0A%0A-%20Operating%20System%3A%0A%0A-%20Attachments%3A%0A%3C%21---%20Please%20attach%20any%20relevant%20files%20%28XML%20documents%2C%20screenshots%2C%20etc.%29%20or%20specify%20the%20document%20template%20you%20were%20using%20--%3E%0A%0A-%20User%20name%20if%20submitting%20an%20issue%20for%20the%20LEAF-embedded%20LEAF-Writer%2C%20or%20the%20Github%20%2F%20GitLab%20%2F%20LINCS%20username%20if%20using%20LEAF-Writer%20Commons.%0A`,
    );
  };

  return (
    <Stack justifyContent="center" alignItems="center" px={2} mt={5}>
      <Chip
        label={`${t('LWC.home.bugs')} / ${t('LWC.home.requests')}`}
        onPointerDown={handleClick}
        size="small"
        variant="outlined"
        sx={{ mb: 1 }}
      />
    </Stack>
  );
};
