import { SvgIcon, type SvgIconProps } from '@mui/material';

export const HighlighterIcon = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <path d="M14.2 3.4 20.6 9.8 10.8 19.6 4.4 13.2z" fill="currentColor" opacity="0.22" />
    <path
      d="M14.9 2.7a2 2 0 0 1 2.8 0l3.6 3.6a2 2 0 0 1 0 2.8l-1.1 1.1-6.4-6.4zm-2.5 2.5 6.4 6.4-8.9 8.9H3.5v-6.4zm-7.3 10.2v3.1h3.1l7.9-7.9-3.1-3.1z"
      fill="currentColor"
    />
    <path d="M2.5 21.5h8.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </SvgIcon>
);
