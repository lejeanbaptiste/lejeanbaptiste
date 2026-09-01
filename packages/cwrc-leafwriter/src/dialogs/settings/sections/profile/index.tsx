import { List } from '@mui/material';
import { DesktopEncoderName } from './desktop-encoder-name';
import { DesktopEntityDatabase } from './desktop-entity-database';
import { DesktopEntityBackup } from './desktop-entity-backup';
import { DesktopEntitySync } from './desktop-entity-sync';

export const Profile = () => (
  <List dense>
    <DesktopEncoderName />
    <DesktopEntityDatabase />
    <DesktopEntityBackup />
    <DesktopEntitySync />
  </List>
);
