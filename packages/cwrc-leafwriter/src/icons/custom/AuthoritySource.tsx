import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { forwardRef } from 'react';

/**
 * Dharma wheel (dharmachakra) mark for DILA (Dharma Drum Institute of
 * Liberal Arts): outer rim, hub, and eight spokes drawn in currentColor.
 */
export const DilaIcon = forwardRef<SVGSVGElement, SvgIconProps>(function DilaIcon(props, ref) {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const x1 = 12 + 3.2 * Math.cos(angle);
    const y1 = 12 + 3.2 * Math.sin(angle);
    const x2 = 12 + 9.2 * Math.cos(angle);
    const y2 = 12 + 9.2 * Math.sin(angle);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    <SvgIcon ref={ref} viewBox="0 0 24 24" {...props}>
      <g stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="9.2" />
        {spokes}
      </g>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </SvgIcon>
  );
});

interface InitialsIconProps extends SvgIconProps {
  top: string;
  bottom: string;
}

/**
 * Generated fallback mark for authority sources without a usable logo
 * (CBDB, CHGIS): the source initials stacked in two rows.
 */
export const InitialsIcon = forwardRef<SVGSVGElement, InitialsIconProps>(function InitialsIcon(
  { top, bottom, ...props },
  ref,
) {
  const rowSize = (text: string) => (text.length > 2 ? 6 : 7.5);
  return (
    <SvgIcon ref={ref} viewBox="0 0 16 16" {...props}>
      <text
        x="8"
        y="7"
        textAnchor="middle"
        fontSize={rowSize(top)}
        fontWeight="700"
        fontFamily="Helvetica, Arial, sans-serif"
        fill="currentColor"
      >
        {top}
      </text>
      <text
        x="8"
        y="14.5"
        textAnchor="middle"
        fontSize={rowSize(bottom)}
        fontWeight="700"
        fontFamily="Helvetica, Arial, sans-serif"
        fill="currentColor"
      >
        {bottom}
      </text>
    </SvgIcon>
  );
});

export const CbdbIcon = forwardRef<SVGSVGElement, SvgIconProps>(function CbdbIcon(props, ref) {
  return <InitialsIcon ref={ref} top="CB" bottom="DB" {...props} />;
});

export const ChgisIcon = forwardRef<SVGSVGElement, SvgIconProps>(function ChgisIcon(props, ref) {
  return <InitialsIcon ref={ref} top="CH" bottom="GIS" {...props} />;
});
