import { List } from '@mui/material';
import { DesktopEncoderName } from './desktop-encoder-name';
import { DesktopEntityDatabase } from './desktop-entity-database';
import { DesktopEntityBackup } from './desktop-entity-backup';

export const Profile = () => (
  <List dense>
    <DesktopEncoderName />
    <DesktopEntityDatabase />
    <DesktopEntityBackup />
  </List>
);
