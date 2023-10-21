import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import { type SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { createSvgIcon } from '@mui/material/utils';
import { Gitlab } from 'mdi-material-ui';
import React from 'react';
import type { IconBaseProps, IconType } from 'react-icons';
import { BiDownload } from 'react-icons/bi';
import { MdLanguage } from 'react-icons/md';
import { RxFileText } from 'react-icons/rx';

const asMuiIcon = (ReactIcon: IconType, props?: IconBaseProps) => {
  return createSvgIcon(<ReactIcon {...props} />, ReactIcon.name);
};

const icons = {
  cloud: CloudQueueIcon,
  computer: ComputerIcon,
  download: asMuiIcon(BiDownload, { x: 1, y: 1 }),
  fileText: asMuiIcon(RxFileText),
  fingerprint: FingerprintIcon,
  github: GitHubIcon,
  gitlab: Gitlab,
  paste: ContentPasteIcon,
  url: asMuiIcon(MdLanguage),
};

export type IconName = typeof icons extends Record<
  infer I,
  OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
>
  ? I
  : never;

export const getIcon = (name: IconName) => {
  return icons[name];
};
