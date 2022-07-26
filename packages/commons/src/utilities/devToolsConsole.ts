import loglevel from 'loglevel';

export const log = loglevel.getLogger('commons-devtools');
log.setLevel('INFO')

const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

const titleStyle = `
  color: ${ dark ? '#DDDDDD' : '#444444' };
  font-size: 20px;
`;

const textStyle = `
  color: ${ dark ? '#CCCCCC' : '#444444' };
  font-weight: 200;
  font-size: 12px;
  letter-spacing: .05em;
`;

log.info(`
%cLEAF-Writer
%c
The XML & RDF online editor of the Linked Editing Academic Framework
`,
  titleStyle,
  textStyle
);

export default {};

