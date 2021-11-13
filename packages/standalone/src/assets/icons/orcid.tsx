import { SvgIcon } from '@mui/material';
import React, { FC } from 'react';

const OrcidIcon: FC = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        x="0px"
        y="0px"
        viewBox="0 0 24 24"
      >
        <g>
          <path d="M13.9,8.7h-2.2v7.4H14c3.3,0,4-2.5,4-3.7C18,10.4,16.7,8.7,13.9,8.7z" />
          <path
            d="M12,0C5.4,0,0,5.4,0,12s5.4,12,12,12s12-5.4,12-12S18.6,0,12,0z M8.1,12v5.5H6.7v-10h1.4V12z M7.4,6.3
		c-0.5,0-0.9-0.4-0.9-0.9c0-0.5,0.4-0.9,0.9-0.9s0.9,0.4,0.9,0.9S7.9,6.3,7.4,6.3z M14.1,17.5h-3.9v-10h3.9c3.7,0,5.3,2.7,5.3,5
		C19.5,15,17.4,17.5,14.1,17.5z"
          />
        </g>
      </svg>
    </SvgIcon>
  );
};

export default OrcidIcon;
