import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { forwardRef } from 'react';

/** Wikipedia “W” mark for authority links (currentColor). */
export const WikipediaIcon = forwardRef<SVGSVGElement, SvgIconProps>(function WikipediaIcon(
  props,
  ref,
) {
  return (
    <SvgIcon ref={ref} viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.09 2C6.53 2 2 6.53 2 12.09c0 5.56 4.53 10.09 10.09 10.09 5.56 0 10.09-4.53 10.09-10.09C22.18 6.53 17.65 2 12.09 2zm4.42 3.15.62 2.08h2.01l-2.56 1.86.98 2.03-2.05-1.48-2.05 1.48.98-2.03-2.56-1.86h2.01l.62-2.08 1.95 1.41 1.95-1.41zm-8.9 0 1.95 1.41 1.95-1.41.62 2.08h2.01l-2.56 1.86.98 2.03-2.05-1.48-2.05 1.48.98-2.03-2.56-1.86h2.01l.62-2.08zM6.2 14.1l3.2-8.55h1.9l3.2 8.55h-1.75l-.7-2.05H8.65l-.7 2.05H6.2zm3.05-3.45h2.7l-1.35-3.95-1.35 3.95z"
      />
    </SvgIcon>
  );
});

WikipediaIcon.muiName = 'Wikipedia';
