import { useColorScheme } from '@mui/material/styles';
import { SvgIcon, type SvgIconProps } from '@mui/material';

export const HighlighterIcon = (props: SvgIconProps) => {
  const { mode, systemMode } = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  const body = isDark ? '#f3f4f6' : '#111827';
  const accent = isDark ? '#cbd5e1' : '#4b5563';

  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      {/* Marker body */}
      <path
        d="M16.85 2.55a2.25 2.25 0 0 1 3.18 0l1.42 1.42a2.25 2.25 0 0 1 0 3.18L9.1 19.5H4.5v-4.6z"
        fill={body}
      />
      {/* Mid-body ferrule */}
      <path
        d="M7.45 14.15 3.3 18.3a1.5 1.5 0 0 0 0 2.12l.28.28a1.5 1.5 0 0 0 2.12 0l4.16-4.16z"
        fill={accent}
      />
      {/* Nib cut / highlight edge */}
      <path
        d="M4.95 20.7h6.15a1.4 1.4 0 0 0 1.04-.46l1.12-1.22-2.4-2.4-1.22 1.12a1.4 1.4 0 0 0-.46 1.04V20.7z"
        fill={body}
      />
      <path
        d="M12.6 16.62 7.38 11.4l9.52-9.52 5.22 5.22z"
        fill={body}
        opacity="0.18"
      />
    </SvgIcon>
  );
};
