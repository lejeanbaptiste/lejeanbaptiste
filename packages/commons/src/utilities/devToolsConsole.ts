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

console.log(`
%cLEAF-Writer
%c
The semantic online editor developed by the Canadian Writing Research Collaboratory
`,
  titleStyle,
  textStyle
);

export default {};

