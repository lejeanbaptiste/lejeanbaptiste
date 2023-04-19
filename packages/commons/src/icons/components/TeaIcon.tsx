import { SvgIcon } from '@mui/material';
import React from 'react';
import './css/tea.css';

interface IconProps {
  color?: string;
  size?: number;
}

export const TeaIcon = ({ color = '#33406f', size = 1 }: IconProps) => {
  return (
    <SvgIcon
      className="tea"
      width={24 * size}
      height={24 * size}
      sx={{ transform: `scale(${size})` }}
    >
      <g>
        <path
          d="M16.3,8.3H4.4c-0.6,0-1,0.4-1,1c0.1,1.7,0.2,5.3,0.7,7.4c0.8,3.3,2.3,5.4,3,6.1c0.2,0.2,0.4,0.3,0.7,0.3h5.1
      c0.3,0,0.6-0.1,0.8-0.4c0.6-0.8,1.8-2.9,2.9-6.1c0.7-2.1,0.8-5.8,0.8-7.5C17.3,8.7,16.9,8.3,16.3,8.3z"
          stroke={color}
          strokeWidth={1 + size / 24}
        ></path>
        <path
          d="M17.3,11.5c0,0,2.7-1.5,3.2,1c0.3,1.5-0.6,3-1.7,3.7c-1.3,0.8-2,0.6-2,0.6"
          stroke={color}
          strokeWidth={1 + size / 24}
        ></path>
        <path
          id="teabag"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
          strokeWidth={1 + size / 24}
          d="M10.8,12.2v-4h-1v4h-1c-0.8,0-1.5,0.7-1.5,1.5v3c0,0.8,0.7,1.5,1.5,1.5h3c0.8,0,1.5-0.7,1.5-1.5
      v-3c0-0.8-0.7-1.5-1.5-1.5H10.8z M8.4,13.7c0-0.3,0.2-0.5,0.5-0.5h3c0.3,0,0.5,0.2,0.5,0.5v3c0,0.3-0.2,0.5-0.5,0.5h-3
      c-0.3,0-0.5-0.2-0.5-0.5V13.7z"
        ></path>
        <path
          id="steamL"
          d="M11.3,0.3c0,0,0,1.7-1.5,2.7S8.4,5.8,8.4,5.8"
          strokeWidth={1 + size / 24}
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={color}
        ></path>
        <path
          id="steamR"
          d="M13.3,2.8c0,0,0,1.1-1,1.7c-1,0.6-1,1.7-1,1.7"
          stroke={color}
          strokeWidth={1 + size / 24}
          strokeLinecap="round"
          strokeLinejoin="round"
        ></path>
      </g>
    </SvgIcon>
  );
};
