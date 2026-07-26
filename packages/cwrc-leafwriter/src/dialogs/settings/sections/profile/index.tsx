import { List } from '@mui/material';
import { DesktopEncoderName } from './desktop-encoder-name';
import { DesktopEntityDatabase } from './desktop-entity-database';

export const Profile = () => (
  <List dense>
    <DesktopEncoderName />
    <DesktopEntityDatabase />
  </List>
);
