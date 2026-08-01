# Le Jean-Baptiste changelog

## 0.0.1–0.0.4-rc.7

- Production and testing of alpha version, distribution chanels, automatic updates, and sibling repos until infrastructure stabilised. 

## Upstream

### Performance and stability

- Established performence baseline on slow Windows test machine
- Virtualised the auto-tagging review list
- App.tsx now keeps Monaco alive after its first Source-mode use, so subsequent Visual ↔ Source switches do not recreate it. Tested, big improvement.
- ui/actions.ts now returns directly to Visual mode when the source buffer is unchanged—skipping both validation and the expensive TinyMCE reload. Tested, big improvement.
- Tree panel work: Tried to improve performance, but with minimal gains. Added a switch to turn off live tracking for older hardware.
- Cut out intentional 1.5-second wait before loading the editor while at once racing with the XML it is trying to load.
- In Windows, command to quit is now carried out with but a slight delay.
- Lazy load panels to keep memory usage down.

### Functionality

- Rebuilt Sanmiao date validation panel to work _with_ the script, setting fixed waypoints to calculate around and allowing the user to enter missing date data (needs testing.)

### UI

- Monaco now opens with the panels collapsed, cannot scroll down to infinity.

### Documentation 

- Cleaned and provided public-facing documentation, including beta tester guide.


### Patch Changes

[924a08a]

- **Update to Reac 18**
  - Update dependencies

[924a08a]

- Updated dependencies
  - @cwrc/leafwriter@1.2.0
  - @cwrc/leafwriter-storage-service@1.1.0
