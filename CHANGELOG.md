# Le Jean-Baptiste changelog

## 0.0.1–0.0.4-rc.7

- Production and testing of alpha version, distribution chanels, automatic updates, and sibling repos until infrastructure stabilised. 

## Downstream

- Cleaned and provided public-facing documentation, including beta tester guide.
- Established performence baseline on slow Windows test machine
- Virtualised the auto-tagging review list
- App.tsx now keeps Monaco alive after its first Source-mode use, so subsequent Visual ↔ Source switches do not recreate it. Tested, big improvement.
- ui/actions.ts now returns directly to Visual mode when the source buffer is unchanged—skipping both validation and the expensive TinyMCE reload. Tested, big improvement.
- Tree panel work:
  - 


### Patch Changes

[924a08a]

- **Update to Reac 18**
  - Update dependencies

[924a08a]

- Updated dependencies
  - @cwrc/leafwriter@1.2.0
  - @cwrc/leafwriter-storage-service@1.1.0
