# CHANGELOG

## 2.6.0

## Features

### Readonly Mode

Add the ability to switch LEAF-Wrirter `readonly` mode on and off.

- Via URL: passing the attribute `readonly=true` in the URL will cause LEAF-Writer to open in readonly mode.
- Via UI: the selector button at the topbar allow users to switch between editing/viweing mode.

## Minor Patches

- rename `isDirty` to `contentHasChanged` [0af820b89760cc6a5de4743e33dc8d21b3dd5e4f] 
- webpack update esbuild configurations [e456cb2b4428d5459078114f85b89e4522e433d7]
- update dependencies [c3e99cb34839c3c752edfd0094948020329d90d1]
  - core:
    - bump up:
      - @mui/icons-material@5.11.9
      - @mui/lab@5.0.0-alpha.120
      - @mui/material@5.11.9
      - axios@1.3.3
      - react-i18next@12.1.5
      - react-router-dom@6.8.1
      - zod@3.20.6
    - dev:
      - upgrade: esbuild@3.0.1
      - update:
        - @types/node@18.13.0
        - @typescript-eslint/eslint-plugin@5.52.0
        - @typescript-eslint/parser@5.52.0
        - eslint@8.34.0
        - webpack-bundle-analyzer@4.8.0
      - bump up:
        - @types/chroma-js@2.1.5
        - @types/express@4.17.17
        - prettier@2.8.4

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@2.5.0
  - @cwrc/leafwriter-storage-service@1.3.7

## 2.5.2

### Patch Changes

- Schema: update orlando schema / css [179a7d70740a78581eb07f9fc9b70596019d762e]
- Prevent editor from refresh when saveas dialog opens (#101) [fb2183bfdbb0d64e6caefdb5527c43ca96d6f2d5]
- autosave: save lastedits instead of the current state of the documents (#105) [fb2183bfdbb0d64e6caefdb5527c43ca96d6f2d5]
- update dependencies [548baff796c99927631221b24010bd8e579b0323]

  - core:
    - upgrade: framer-motion@9.0.0
    - update:
      - axios@1.3.0
      - broadcast-channel@4.20.2
      - mui-modal-provider@2.2.0
      - react-router-dom@6.8.0
    - bump up:
      - @mui/lab@5.0.0-alpha.118
      - @mui/material@5.11.7
      - @octokit/rest@19.0.7
      - i18next@22.4.9
      - keycloak-js@20.0.3
      - material-ui-popup-state@5.0.4
      - react-i18next@12.1.4
      - react-responsive-masonry@2.1.7
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@ 5.50.0
      - @typescript-eslint/parser@5.50.0
      - esbuild-loader@2.21.0
      - eslint@8.33.0
      - eslint-plugin-react@7.32.2
      - tslib@2.5.0
    - bump up:
      - @types/express@4.17.16
      - @types/node@18.11.18
      - css-loader@6.7.3
      - prettier@2.8.3
      - typescript@4.9.5

- Updated dependencies
  - @cwrc/leafwriter@2.4.0
  - @cwrc/leafwriter-storage-service@1.3.6

## 2.5.1

### Patch Changes

- Let storage service dialog open if no provider is set (guest user) [ca37f2d9d5a0a8f2b311fbef5bc74bd3188d574d]
- Profile menu: rename option 'privacy' to 'privacy settings' [082005be54d14becb6f789e457733ee2bc81b75b]
- Privacy. Update description of basic usage [17f1ec9bb2ad20ee8ee93d1dd65e818e1b1c6fc1]
- Update dependencies [937555e895081d83d0043b6b252d9f3f77e1e6c6]
  - core:
    - upgrade: material-ui-popup-state@5.0.3
    - fixed version: query-string@7.1.3
    - update:
      - @mui/icons-material@5.11.0
      - @mui/material@5.11.0
      - framer-motion@7.8.0
      - i18next@22.4.5
      - react-i18next@12.1.1
      - zod@3.20.2
    - bump up:
    - @mui/lab@5.0.0-alpha.112
    - keycloak-js@20.0.2
    - react-router-dom@6.4.5
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.46.1
      - @typescript-eslint/parser@5.46.1
      - eslint@8.29.0
    - bump up:
      - @types/node@18.11.14
      - mini-css-extract-plugin@2.7.2
      - prettier@2.8.1
      - typescript@4.9.4

## 2.5.0

### New Feature

#### Add support to orcid

- Users can now link to their ORCID account as an identity provider. [06414acc052432ac622dbbade04f95c701ec4276]

#### Redesign the profile menu

- Move options to submenus, creating more consistency in the design. It also decouples the storage provider from the identity provider. [2a42285e21d092cd5a268ebee015752397458979]
- The user profile shows the user Id instead of the email. The ID is clickable and links to the user URI. [0a3079cfea286bee593e112472bdd9af4fb76def]
- When editing a document, the profile menu hides the option to switch identity providers. This is to prevent the user from changing their identity while editing a document. [0a3079cfea286bee593e112472bdd9af4fb76def]

### Patch

- Capitalize "We use Cookies" [0e3ae2f587471efdc8552e80d78064d0818a62e4]
- Replace icon for user management account for a gear [ab67bf494e2a4e81b13699ae057878f5f8e4c8fd]
- Correct user profile card background color [2365a56c73eb261d489807da7c69bbb24bcabbc0]
- Move cloud disable message to a hook [a91a09dca672bfc697d35e97f045b0abd42316f5]
- Home storage tooltip: fix width [5ab76611d91f1fe5d2ef53f51b43b34f00cba0a8]
- Add disable cloud storage message to main menu [9105c4cf5a074ab1c608e556d459526ed012587b]
- Rename types [a6ce2d6c535a83d1fb7fe73abd63f7fd19e240f0]
- Handle axios error [b3b556e582d633ffce9f97aa796e3c6466d98b65] [91a362ad2ef98a6089edb223be629468ac562c8b]
- Add localization [c7f1efb3e4e94a0d2f5312f9c96b121cf0fa42ef]
- Update dependencies [228a09db7576cb7ee826543477b1d7d943073a8c]
  - core:
    - update: axios@1.2.1 [026dd05cbd4cdb410210824133868ab28aacbcbb]
    - bump up:
      - @mui/icons-material@5.10.16
      - @mui/lab@5.0.0-alpha.110
      - @mui/material@5.10.16
      - framer-motion@7.6.19 [026dd05cbd4cdb410210824133868ab28aacbcbb]
      - helmet@6.0.1
      - i18next@22.0.8 [026dd05cbd4cdb410210824133868ab28aacbcbb]
      - query-string@7.1.3
      - react-router-dom@6.4.4
      - vanilla-cookieconsent@2.8.9
  - dev:
    - upgrade:
      - webpack-cli@5.0.1 [026dd05cbd4cdb410210824133868ab28aacbcbb]
      - webpack-de-middleware@6.0.1
    - update:
      - @typescript-eslint/eslint-plugin@5.45.1 [026dd05cbd4cdb410210824133868ab28aacbcbb]
      - @typescript-eslint/parser@5.45.1 [026dd05cbd4cdb410210824133868ab28aacbcbb]
      - eslint@8.28.0
      - mini-css-extract-plugin@2.7.1
      - prettier@2.8.0
    - bump up:
      - @types/node@18.11.10
      - eslint-plugin-react@7.31.11
      - ts-loader@9.4.2

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@2.3.1
  - @cwrc/leafwriter-storage-service@1.3.5

## 2.4.0

### Minor Changes

- Implement identity provider discovery from keycloak. Reorganize overmind scopes. Fetch provider list from keycloak and use the ones wth supporting libraries. [cabf9bc8a88c11cb37bc2318eb9e250a4bc02097]

### Patch Changes

- update dependencies [f534ed69b4c31cbe406435a70f60f6aa42fd75e6]:
  - core:
    - add:
      - zod@3.19.1
  - bump up:
    - @mui/icons-material@5.10.14
    - @mui/lab@5.0.0-alpha.108
    - @mui/material@5.10.14
    - framer-motion@7.6.7
    - i18next@22.0.5
- dev:
  - update:
    - @typescript-eslint/eslint-plugin@5.43.0
    - @typescript-eslint/parser@5.43.0
    - typescript@4.9.3
  - bump up:
    - css-loader@6.7.2 webpack-hot-middleware@2.25.3

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter-storage-service@1.3.4

## 2.3.1

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter-storage-service@1.3.3

## 2.3.0

### Homepage

- Add info about supported schemas, custom schemas, and guest user. [b09fdcd2b263f87d1b4d2e954494b4f56eaec764]

### Minor Changes

- Include support to LEAF Schemas [649e146c37d373fb9e18eb29eed81e7828d6b664]
  - Schemas added for dev testing only: `CWRC TEI Lite`, `REED`, `CWRC Entry`, and `Orlando Events`

### Patch Changes

- Profile panel: correct propup message over identity and storage providers [7c31b5504f01256306ff815046f5c716c9357945]
- Update dependencies [f540e3fc481ca8fe58c22a303769abbd7c872a6c]:
  - core:
    - fixed version:
      - react-markdown@6.0.3
    - upgrade:
      - @cwrc/leafwriter@2.3.0
      - axios@1.1.3
      - i18next@22.0.4
      - i18next-browser-languagedetector@7.0.1
      - keycloak-js@20.0.1
      - react-i18next@12.0.0
    - update:
      - framer-motion@7.6.5
      - mdi-material-ui@7.6.0
    - bump up:
      - @cwrc/leafwriter-storage-service@1.3.2
      - @analytics/google-analytics@1.0.5
      - @emotion/react@11.10.5
      - @emotion/styled@11.10.5
      - @mui/lab@5.0.0-alpha.107
      - @mui/material@5.10.13
      - broadcast-channel@4.18.1
      - loglevel@1.8.1
      - notistack@2.0.8
      - react-router-dom@6.4.3
      - vanilla-cookieconsent@2.8.8
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.42.1
      - @typescript-eslint/parser@5.42.1
      - eslint@8.27.0
      - webpack@5.75.0
      - webpack-bundle-analyzer@4.7.0
    - bump up:
      - @types/node@18.11.9
      - tslib@2.4.1

## 2.2.0

### New Features

#### Anonymous user

Initialize LW Editor without a user if unauthenticated and Remove the method to create an anonymous user. LEAF-Writer will editor creates an anonymous user if no user is defined. [5e6d87db4d69b12475632c99a32b95cb5f07dc6a] [57516c798e3438a05dfd46a4a591acc22ffb02d6]

#### Improved homepage storage panel

Add grid view, thumbnails, and a more responsive design.

Thumbnails are generated by LW editor using `getDcoumentScreenshot`. Samples and Templates must have their thumbnails generated manually and added to the JSON file. Recent files thumbnails are generated when the user opens the document and when the document is saved. They are saved in the local storage together with the list of recent files.

[e763547f2df433d2c8b62bd8fe822602334965ee]

### Minor

- Localization: add terms [80d1a6668c83530683d63c8299ffbe840c63b3bf]

### Patch

- Profile: signing out doesn’t show warning if editor is not dirty [4af6f82e21e932af11ca0b29ef62567cbef5f5dd]
- Storage panel: Translate the view's title [fc824f6ad919249dcd6bddbab07465d44b421662]
- Update dependencies [a19b79f92bfb92cb7a073271268fcccebc2bd568]:
  - core:
    - add:
      - react-responsive-masonry@2.1.6
    - bump up:
      - @octokit/rest@19.0.5
  - dev:
    - add:
      - @types/react-responsive-masonry@2.1.0
    - update:
      - @types/node@18.11.0
    - bump up:
      - css-minimizer-webpack-plugin@4.2.2

## 2.1.0

## New Features

### Introduce privacy policy and cookie consent management

[19c3cf996623b61288f0a97ae7f6129f47a2762d]

In accordance with **GDPR (Europe), LGPD (Brazil), and CCPA (California)** laws, we add:

- A banner on the homepage asking the user to consent to opt-in to our privacy policy and cookies trackers.
- A consent management setting allows users to revoke or change the consent at any time.
- Add Terms of User and Privacy policy.

The cookie’s consent has three levels:

- Strictly necessary (for storing cookies preferences)
- Basic functionalities (including login, tokens, and user preferences
- Measurement (for Analytics purposes).

Users can manage their preferences, revoking the consent at any time.

- Revoking `measurement` will block Google Analytics, for instance.
- Revoking basic functionalities will sign the user out and wipe all cookies (except for the cookie preferences)

**Sign-in is now only enabled when the user accepts the terms.**

### Enable not registered users to use LEAF-Writer [c1501e756ac4a3d62421ed467442a037eff3fb39]

Not registered users can open templates and sample documents as well as upload and paste XML from their devices without having to sign in. They have full access to LEAF-Writer except for a few features that require registration, notably opening and saving files from and to the cloud (GitLab / GitLab)

**When annotation a document, the web annotation will be signed off by an anonymous user without id or URI.**

As a reflection of this change, we completely redesigned the storage panel on the homepage (below)

## Redesign the storage panel on the homepage

The new storage panel allows any user to:

- Open files from the device
- Paste XML directly on the page
- Open templates
- Open sample files

**Only registered users can open from the cloud or see recent documents.**

### Introduce autosave

[554853025bfe3e2a974cd2ef16c93a190b7307d0]
[bca43e335a36d5fc80bc6f5b76e01622ac334b24]

LEAF-Writer will set a `60s` timer every time the document becomes `modified`. After this time, LEAF-Writer will trigger the save function.

Users can also trigger the save function by themselves, which, in this case, will take priority over the timer.

The timer resets and stops after the file are saved.

If the storage provider responds with a conflict (error 409), LEAF-Writer will make `5 subsequent attempts to save the file in `10s interval`. If the error persists, it continues to try to save the file every `60s`.

### Get language from the URL

[e67f4e81a6905b674cc6731ed38af3a1b8c11aea]

It is possible now to pass the language in the URL. For instance, `https://leaf-writer.leaf-vre.org?lang=fr-CA` will load the page in French without the user’s input.

### Allows open sample and template documents from permalink

[e58efd1267fb960917a6e0cd61c8ba615d53172f]

For instance, users can directly open a prose template by accessing `https://localhost/edit?template=Prose`.

### Keycloak callback right to where the user left off when they sign in

[766b1e417e8cc08ecfc9db7de7cd015e2cee9efc]

This is to allow users that already opened a document or accessed the French version using the search parameters in the URL to come back to the same page they were before clicking on sign in.

## Mobile version will not display the storage panel

The screen is really too tiny for LEAF-Writer. Until we have a good UX plan to allow LEAF-Writer to be used on mobile, we should direct users to a large screen. The following message will display on mobile:

`Annotating large corpora requires more space. Please rotate your phone or open LEAF-Writer on a large monitor.`

### Patch

- Fix: Tweak get / set from localStorage [8249f776c5c55204f9153d45a20f979e35c37fd5]
- Fix: Localization: reorganize and add new translations [675aa4cdff800f52a432ddbc6caea93e88318191]
- Fix: Cookies consent: banner buttons position [8a8fc6e3490fc38cd29bd95797f39c67f56c6327]

- Fix: Profile: stop event propagation when click to open settings [fca10f28ebc4bea8cda3f9a03d2e5746d3b843e1]
- Fix: Localization: change language of cookies consent when switching language [c7952f6805749a82fb3329151d55ddd86de35912]
- Fix: Warn user of unsaved changes when signing out [12379d84b1e9dbc4f14521d57e7ef38d1de5328c]
- Fix: Warn user about unsaved changes when revoking all consent categories [6457d82ada9c8b4b109d6c7a38d2578a60d9212b]
- Fix: Autosave: only if the user is register and the file is in the cloud [0a72fc60519001c16837a7fc86db41286a13d5ce]
- Fix: Autosave: increase interval from 30s to 60s [21623a851504a4d55c411a316fed7fe64c1d95dd]
- Fix: About: adjust responsive on mobile [7b22ca6994b6ba73b2c3b56edba46bbff7be707e]
- Fix: Templates Dialog: redesign [15c1ed1659e087c51ea69e7149d243aeb65f5c4a]
- Fix: Localization: complete reestructure [1c863598d331a5ba95bfa995f3b43ff6b2377b96]

- Refactor: move icons folder [fe9f418997f65686f460c285565230f273c03b53]
- Refactor: Rename template dialog component [ee35205850dc94cd3cecbc2dc655e66c82ef2cf8]
- Refactor: Centralize icon management into a single folder [37337c336a8cc8970d5a37869096b1232450d89a]
- Refactor: Use named exports instead of the default. Organize import types [f18632925285f3b81627e0131a214afc17ea3b93]
- Refactor: Storage effects: Use internal API instead of accessing localStorage directly. Rename, coalesce, and add types to functions [ef6aef8017834694a65572a763af9365a9877e3c] [84369af4b5a247151493b3d152bdc0abdf2137f7]
- Refactor: do not load gitlab service for now [8f74b28a2188a3d4dc204ae5e568740fa4ed1a5a]

- Docs: Add inline documentation [6fdebe74f4cec99c5dd3122fc949bee8d8a0fd7f] [5b6f44b8a6742a58c0164ca7a836fee3a14f28e0]

- Update dependencies:
  - core:
    - update:
      - broadcast-channel@4.18.0
      - framer-motion@7.5.3
      - i18next@21.10.0
    - bump up:
      - @fontsource/lato@4.5.10
      - @mui/icons-material@5.10.9
      - @mui/lab@5.0.0-alpha.103
      - @mui/material@5.10.9
      - body-parser@1.20.1
      - express@4.18.2
      - i18next-browser-languagedetector@6.1.8
      - keycloak-js@19.0.3 react-router-dom@6.4.2
  - dev:
    - update:
      - @types/node@18.8.4
      - @typescript-eslint/eslint-plugin@5.40.0
      - @typescript-eslint/parser@5.40.0
      - css-minimizer-webpack-plugin@4.2.1
      - eslint@8.5.0
      - less-loader@11.1.0
    - bump up:
      - eslint-plugin-react@7.31.10
      - typescript@4.8.4

## 2.0.2

### Patch Changes

- Tweak get / set from localstorage

## 2.0.1

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@2.0.1

## 2.0.0

### Major Changes

- Change LEAF-Writer instantiation. Improve topbar, saving feedback, and main menu [6801bbea37e06faeca3d8d7c0e7044e46e3cc265]

Top bar has improved UX to show the document full path and saving feedback.

Main Menu was redesigns and has new options: 1. New from a template, 2. Open Recent.

BREAKING CHANGE: 🧨 LEAF-Writer must be instantiate just with the container element. To render the editor, we need to run the method `init` passing the document and other options.

- Add option to download the file from the main menu [39bc96213e15319e236ec3f32e7ebb842a50d468]
- Improve UX access to template [102ed3b08f300e66a1a975605c936f70edf54296]

Move templates to a json file. Create a Dialog to show and select templates.

- Redesign dialogs to match the rest of the UX. [ea9539f34110741bd03e30f7d814f4f68313a81f]

Messages Dialogs are now centralized in a manager and UX is more aligned to the core LEAF-Writer. More localization were added.

### Patch

- Improve API to save/retrieve from localstorage [53024c90c970cca49a13d83444651d0f92b15803]
- Redesign recent document section [b01dda0319b9ba01af6f80381c3ac7a91ebb5d5c]
- Auto-dectect dark mode [ca21a8a95da2d427b00179612876e3f78b33977a]
- Reorganize folder and paths [aaf6b98380e825c4ce1bd67e67ae784c3f47647f]
- Update Dependencies [e7688fa7641b3c6caa1477c2bbcaa41717de6769]
  - core:
    - add:
      - file-saver@2.0.5
      - material-ui-popup-state@4.1.0
      - mui-modal-provider@2.1.0
      - uuid@9.0.0
    - bump up:
      - @mui/icons-material@5.10.6
      - @mui/lab@5.0.0-alpha.100
      - @mui/material@5.10.6
      - framer-motion@7.3.6
      - i18next@21.9.2
      - react-router-dom@6.4.1
  - dev:
    - update:
      - webpack-bundle-analyzer@4.6.1
      - eslint@8.24.0
      - ts-loader@9.4.1
    - bump up:
      - @types/node@18.7.19
      - @typescript-eslint/eslint-plugin@5.38.0
      - @typescript-eslint/parser@5.38.0

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@2.0.0
  - @cwrc/leafwriter-storage-service@1.2.0

## 1.8.0

### Features

#### See document's full path

Hovering on top of the docuemnt's title at the top bar reveals its full path, including storage provider, owner, and repository

#### Saving feedback UX

The cloud next to the document's title got new and bigger icons:

- Checkmarck cloud: Document is saved. Document has no changes
- Orange cloud with a dot: Document has changes, needs to be saved.

After saving, a snackbar will inform the user if the saving was successfull.

#### Bugs / Requests

Users have a quick access to GitLab tickecting system on LEAF-Writer homepage.

### Minor Changes

- Return to home when close editor [12b254a97e6d69c54cfb09b1ff199b7e6942a8b1]
- Show full document path in the top bar. Better UX feedback when saving [62bdb960ac5dc41b495f50c7b0d49ab372c931a5]
- Recent document: show full path. Add button to remove from list [e0947168de000f0d07d9397b76fb4301cb7be754]
- Add bugs/requests button [2f3f3dfcf9da3e940f95ceca013d3f5cf4c19e79]

### Patch Changes

- Load new document with another already loaded [4cdf888b0f6b2026be7fd2fde5460629261aa43e]
- Fix color and spacing [31118574ad074f7ebdaf49fd530e18db1e6aff08]
- Organize files, improve types, formating [7d3ed04cb3b8d7b4f4f9761be453a28e84bfaa3d]
- Improve keyboard sensor for menu access by keyboard shortcuts [fa3c364fbad216cc7f8465097bbd8379d00fef02]
- Add localization [ba80c86ae51669834e3576826adbe8b21b2021d8]
- Dependencies [0276292bc38c9f822157affd5375b337a810de00]:
  - core:
    - upgrade:
      - helmet@6.0.0
    - update:
      - @mui/icons-material@5.10.3
      - broadcast-channel@4.17.0
      - framer-motion@7.3.5
      - react-router-dom@6.4.0
    - bump up:
      - @emotion/react@11.10.4
      - @emotion/styled@11.10.4
      - @mui/lab@5.0.0-alpha.99
      - @mui/material@5.10.5
      - @octokit/rest@19.0.4
      - date-fns@2.29.3
      - i18next@21.9.1
      - keycloak-js@19.0.2
      - overmind@28.0.2
      - overmind-react@29.0.2
      - react-i18next@11.18.6
  - dev:
    - update:
      - @types/webpack-env@1.18.0
      - @typescript-eslint/eslint-plugin@5.37.0
      - @typescript-eslint/parser@5.37.0
      - css-minimizer-webpack-plugin@4.1.0
      - esbuild-loader@2.20.0
      - eslint@8.23.1
      - eslint-plugin-react@7.31.8
      - typescript@4.8.3
    - bump up:
      - @types/express@4.17.14
      - @types/node@18.7.18
      - nodemon@2.0.20
      - webpack-bundle-analyzer@4.5.1
  - @cwrc/leafwriter@1.9.0
  - @cwrc/leafwriter-storage-service@1.1.2

## 1.7.1

- Updated dependencies
  - @cwrc/leafwriter@1.7.0
  - @cwrc/leafwriter-storage-service@1.1.1

## 1.7.0

### Minor Changes

- [c9e4b571fca179b9adc2a0b4c16d412baafb4f0d] auth: Bypass keycloak login screen allowing sign in directly from providers

### Patch Changes

- [ef2eea5a15235c0742220bb95226b8fc0b96a087] Theme: align primary color with the brand style guide
- [97d08bfcee68318629de215c326089d5c6b43ea8] Update framer-motion attributes
- [ec12bad89bcd1c3fb42b6c0220f01b949c06f3ef] Improve localization

## 1.6.0

### Minor Changes

[6741e61de29e4db4281755c097026e3ac89d4214] Add suport for gzip compression.

[108f58be6df4cc6be543e9c62815e7cc822c8564] Temporarily drop support for GitLab identity and storage (see issue #33)

## 1.5.0

### Minor

[7c21ecc9e2a2a639e4297111488e48988223bcd9] Setup analytics

[d4ce4a2a86b30af92212108ef094f9a996eb2389] Lookups: Get geonames username from the server

[3af22b514f923cb8034ef3b57d317c8a4dad6c66] Authentication: get keycloak and nssi url from the server

[586764da5cfc3acbb61ccc6b9120dad27ff6d133] Server add endpoints to fetch env variables

## Fix

[89f3979aa71aa67fe15279e474618907e3f34a5d] Get identity provider

### Chores

[bc8535061183ba35ccb89fb5121bdd925f4c0d0b] Update dependecies

[f845dcdc0df0aedd79e80d5a7f23073788841add] nodemon: extend watch to sub folders

[8988f3be436f1fdb8bd40e4a75a0b28ec99f968c] remove .env from webpack build

## 1.4.1

### Patch Changes

- New release
- Updated dependencies
  - @cwrc/leafwriter@1.6.2

## 1.4.0

### Minor Changes

### Feature

[7b90ba27ea6ab179188f2c5d5298e1d2dc8f106b] Service provider: Reorganize types and improve typying

### Fix

[5532b0c7035e3fe878ed658bd2098835eca9543a] Localization: Remove unused terms

### CI

[cade8ad0292f8cca4a02a1d7a36fc166e395df21][c79b58dcc1b499947980fd8f10bfe468587d8a71] Use enviroment variables

### Chore

[de7cb02044fe4b4932754a8cfc0ca8ad06230a8][96308bb1d4ef67d0b97cd1d324e7c28df86e3f2e] Upate Dependencies

## 1.3.2

### Fix

[6ac21389238cdb01a5bc2db39d1e84892d16ccb0] Regression: keycloak endpoint change: Remove `/auth` .

### Dependencies

[161ed59eebaa0e22f1a9e4d4c7405136c6527922] core: upgrade: keycloak-js@19.0.1
[8bf3ee71a31d396e6deba4d68d086e2dd928bd3c] core: bump up: @cwrc/leafwriter@1.6.1

## 1.3.1

### Fix

[d8eaf9aebe1693d02dcd5486c21ac241d4f25d30] Homepage: update the subtile and the About section

### Dependencies

[3946c6c8dd89d11338ef55777fafb3dfe01cf0a4] Core: update: @cwrc/leafwriter@1.6.0

[74b9e893d425c95b3331d66e6eccf4d44342818c] Update dependencies

- core
  - update
    - @cwrc/leafwriter@1.6.0
    - @mui/lab@5.0.0-alpha.92
    - @mui/material@5.9.2
    - broadcast-channel@4.14.0
    - date-fns@2.29.1
    - framer-motion@6.5.1
    - react@18.2.0
    - react-dom@18.2.0
    - react-i18next@11.8.1
  - bump up
    - @octokit/rest@19.0.3
    - helmet@5.1.1
    - i18next@21.8.14
    - keycloak-js@18.0.1
    - kleur@4.1.5
- dev
  - update
    - @types/node@18.6.1
    - @typescript-eslint/eslint-plugin@5.31.0
    - @typescript-eslint/parser@5.31.0
    - eslint@8.20.0
    - eslint-plugin-prettier@4.2.1
    - eslint-plugin-react-hooks@4.6.0
    - ts-node@10.9.1 webpack@5.74
  - bum up
    - @types/chroma-js@2.1.4
    - eslint-plugin-react@7.30.1
    - mini-css-extract-plugin@2.6.1
    - nodemon@2.0.19
    - prettier@2.7.1
    - ts-loader@9.3.1
    - typescript@4.7.4

## 1.3.0

### Major

This version brings two new features:

1. Remove endpoints acting as proxy for loading external resources.
2. New logo :)

### Features

[892431842c5f4e9d528fa534c9819d2787e9a820] server: remove endpoints acting as proxy for loading external resources due to CORS. LEAF-Writer will handle this internally.
[5d85f0c2da0a92fe733497561e7ad5c90168d527][e7fb7df8fb66e155158a49250f207b1983b294c7] New logo

### Fix

[d076bc471a019a195c1f19d126117d9ddc272960] Adjust homepage layout on mobile
[2c27a2a03059a71afce5748f7bf00e3fe52c2d97] leafwriter config: remove baseUrl and nerveUrl
[d11962a645d08d87344b64da132cd3acd6c02e91] Remove configurations for CWRC lookups (deprecated)

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@1.5.0

## 1.2.2

### Patch Changes

- changes how LEAF-Writer configures itself, specifically the path to dep files and proxies
- Updated dependencies
  - @cwrc/leafwriter@1.4.0

## 1.2.1

### Patch Changes

- 2a97acf: Allows to open the settings dialog from outside LEAF-Writer
- Updated dependencies [2a97acf]
  - @cwrc/leafwriter@1.3.0

### Minor Changes

[0e565de]

- [feat] Add a log manager to improve dev/prod versions
  - We use loglevel to control when to output logs (no more dirty logs on production version).
- [fix] Mimetype on storage service panel: from `text/xml` to `application/xml`
- [fix] Add language to main html tag

[1e4b13b]

- **Leaf-write as a instanciable class**
  - Create a new instance passing the content and config.
  - It requires the content to be edit a set of config options.
  - Track onload/onchange events
- [UX] New top bar
  - Includes load/save funcionalities, keyboard shortcuts, metadata and profile
- [UX] Redesing storage panel and sign section
- [UX] Improve auth state and profile UI
- [UX] Add settings to profile menu
- [UX] New Icons
- [Progress] New loading animation
- [Chore] Split overmind state/actions
- [Chore] Rename folder @types to types
- [Chore] Rename config file
- [Chore] Add prettier to eslint
- [Dependencies] update

### Patch Changes

[924a08a]

- **Update to Reac 18**

  - Update dependencies

[924a08a]

- Updated dependencies
  - @cwrc/leafwriter@1.2.0
  - @cwrc/leafwriter-storage-service@1.1.0
