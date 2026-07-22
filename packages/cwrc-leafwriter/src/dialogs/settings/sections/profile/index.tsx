import { List } from '@mui/material';
import { DesktopAchievementsStorage } from './desktop-achievements-storage';
import { DesktopEncoderName } from './desktop-encoder-name';
import { DesktopEntityDatabase } from './desktop-entity-database';

export const Profile = () => (
  <List dense>
    <DesktopEncoderName />
    <DesktopEntityDatabase />
    <DesktopAchievementsStorage />
  </List>
);
