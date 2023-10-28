import { createTheme } from '@mui/material';
import { SimplePaletteColorOptions } from '@mui/material/styles';
import chroma from 'chroma-js';
import { IconLeafWriter } from '../icons';

interface Entity {
  color: SimplePaletteColorOptions;
  icon: IconLeafWriter;
}

interface Entities {
  person: Entity;
  place: Entity;
  organization: Entity;
  org: Entity;
  title: Entity;
  referencing_string: Entity;
  rs: Entity;
  thing: Entity;
  citation: Entity;
  note: Entity;
  date: Entity;
  correction: Entity;
  keyword: Entity;
  link: Entity;
}

declare module '@mui/material/styles' {
  interface Theme {
    entity: Entities;
  }

  interface ThemeOptions {
    entity?: Entities;
  }
}

// Update the Button's color prop options
// declare module '@mui/material/Button' {
//   interface ButtonPropsColorOverrides {
//     person: true;
//   }
// }

// declare module '@mui/material/Icon' {
//   interface ButtonPropsColorOverrides {
//     person: true;
//   }
// }

// declare module '@mui/material/SvgIcon' {
//   interface ButtonPropsColorOverrides {
//     person: true;
//   }
// }

const theme = (darkMode: boolean) =>
  createTheme({
    entity: {
      person: {
        color: { main: chroma.rgb(46, 134, 222).hex() },
        icon: 'person',
      },
      place: {
        color: { main: chroma.rgb(255, 159, 67).hex() },
        icon: 'place',
      },
      organization: {
        color: { main: chroma.rgb(176, 185, 122).hex() },
        icon: 'organization',
      },
      org: {
        color: { main: chroma.rgb(176, 185, 122).hex() },
        icon: 'organization',
      },
      title: {
        color: { main: chroma.rgb(175, 70, 240).hex() },
        icon: 'title',
      },
      referencing_string: {
        color: { main: chroma.rgb(131, 149, 167).hex() },
        icon: 'referencing_string',
      },
      rs: {
        color: { main: chroma.rgb(131, 149, 167).hex() },
        icon: 'referencing_string',
      },
      thing: {
        color: { main: chroma.rgb(131, 149, 167).hex() },
        icon: 'thing',
      },
      citation: {
        color: { main: chroma.rgb(0, 128, 64).hex() },
        icon: 'citation',
      },
      note: {
        color: { main: chroma.rgb(224, 190, 0).hex() },
        icon: 'note',
      },
      date: {
        color: { main: chroma.rgb(253, 119, 170).hex() },
        icon: 'date',
      },
      correction: {
        color: { main: chroma.rgb(191, 4, 4).hex() },
        icon: 'correction',
      },
      keyword: {
        color: { main: chroma.rgb(16, 172, 132).hex() },
        icon: 'keyword',
      },
      link: {
        color: { main: chroma.rgb(70, 130, 180).hex() },
        icon: 'link',
      },
    },
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? chroma.rgb(191, 213, 213).hex() : chroma.rgb(28, 64, 69).hex(),
      },
      secondary: {
        main: chroma.rgb(255, 114, 0).hex(),
      },
    },
    typography: {
      fontFamily: 'Lato, Helvetica, Arial, sans-serif',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          @font-face {
            font-family: 'Lato';
            font-style: normal;
            font-display: swap;
            font-weight: 300;
            src: "local('Lato'), local('Lato-Regular')";
            unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF',
          }
        `,
      },
    },
  });

export default theme;
