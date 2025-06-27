# CHANGELOG

## 3.7.3

### Patch Changes

- Updated dependencies
  - core:
    - update:
      - @cwrc/leafwriter-storage-service@4.0.2
      - @cwrc/leafwriter@3.8.1
      - axios@1.10.0
      - i18next-browser-languagedetector@8.2.0
      - motion@12.19.2
    - bump:
      - @emotion/styled@11.14.1
      - @fontsource/lato@5.2.6
      - @mui/icons-material@7.1.2
      - @mui/lab@7.0.0-beta.14
      - @mui/material@7.1.2
      - query-string@9.2.1
      - react-i18next@15.5.3
      - react-router@7.6.3
      - zod@3.25.67
  - dev:
    - bump:
      - @types/compression@1.8.1
      - @types/express@4.17.23
      - @types/node@22.15.33


## 3.7.2

### Patch Changes

- [9d8744e11e1571b31bddc3b95c335c14eff813ad] Get sample and templates from a new repo: [LEAF-templates](https://github.com/LEAF-VRE/LEAF-templates) (Closes: #273)
- Updated dependencies
  - @cwrc/leafwriter@3.8.2

## 3.7.1

### Patch Changes

- Fix dark mode when not authenticated
- Fix icon name type inference
- Updated dependencies
  - core: bump: @cwrc/leafwriter@3.7.1

## 3.7.0

### Minor Changes

- Bring Helmet back [8782b47be3337eb2304b322f87e1e3fea8f7b4c7]
- Dev: add react-scan [8c92cc29ad011c233f81aac45122df08a824d16b]
- Replace axios with fetch [76798a7ea7465d585db1bd48d27a7df50d1509a2]
- Hide bug report on mobile [a7265b1748a45a9ce19c839c2bb56e1c69680a92]
- Add icon for drama genre [2162632652522b366c25637516629266225c2262]

### Patch Changes

- Sample files: regenerate screenshots [b524c73bf16cda4cfd2e62d11711dcf0c2310645]
- Templates: update url and regenerate screenshoots [74ce11d1441962672541d8159811c9918902594f]
- Improve types [2cd06d48e666f3c4ad270b2f95651884dce88178]
- Theme (mui): use vars instead of palette to correctly render dark mode [8478488b9f5d4647d14cc80381929762ade26e32]
- Update Mui to v7 [bf571a21fcde0f42a9dbe6f377daae256e3a323d]
- Remove unused code [09f734adb091ccf05ce31aa19caed553b63cf86c]
- Remove clean script from build (it was removing essential dependencies) [0b7033bfcbf9ff4644ed7e47726dbeeccc27b02b]
- Update dependencies
  - core:
    - upgrade:
      - @mui/icons-material@7.1.1 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - @mui/lab@7.0.0-beta.13 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - @mui/material@7.1.1 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - @octokit/rest@21.0.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - i18next@25.2.3 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
    - update:
      - @fontsource/lato@5.2.5 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - axios@1.9.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - broadcast-channel@7.1.0 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - @cwrc/leafwriter@3.7.0
      - @cwrc/leafwriter-storage-service@4.0.1
      - helmet@8.1.0 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - keycloak-js@26.1.4 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - i18next-browser-languagedetector@8.1.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - motion@12.16.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - query-string@9.1.1 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - react-icons@5.5.0 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - react-i18next@15.5.2 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - react-markdown@10.1.0 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - react-router@7.6.2 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - zod@3.25.5 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
    - bump:
      - @ts-rest/core@3.52.1 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - jotai@2.12.5 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - keycloak-js@26.2.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - material-ui-popup-state@5.3.6 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - mdi-material-ui@7.9.4 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - overmind@28.0.4 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - overmind-react@29.0.6 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - react-dropzone@14.3.8 [cc11715a7506d6b2d6b01a96dc9bc88bd5f639e8]
      - react-scan@0.3.4 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - swr@2.3.3 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
  - dev:
    - upgrade:
      - @octokit/types@14.1.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - @types/webpackbar@5.0.0 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - copy-webpack-plugin@13.0.0 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
    - update:
      - @types/compression@1.8.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - @types/node@22.15.30 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - less@4.3.0 [2b0207767469d416363d8a4481d03f094130bfcc]
      - tsup@8.5.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - typescript@5.8.3 [25ddb8b283c7f907e278b54e926906909202930e]
      - webpack@5.99.9 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
    - bump:
      - @types/express@4.17.22 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - @types/react-dom@18.3.7 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]
      - css-minimizer-webpack-plugin@7.0.2 [ad769eb60ea2eed69d7a4f1bd7d601a5a3d580c4]
      - less-loader@12.3.0 [ee07219d0d50a6b90bb5b6072bd346c80dabf221]

## 3.6.0

### Minor Changes

- [f5cd1f0a48fe3d4733afd7f9e2b254274c69fb77] remove logic related to legacy feature: nerve / nssi
- [4ee3972a01449a8fc8670e6f0e015a1950e94b40] remove endpooint to fetch internal geonames-username
- [09fcde11fec2412b968e12db9432868a2cbc5f74] add LGPN as a custom authority

### Patch Changes

- [683c11a97ff8c450b9f9154e49fb33bdb70d2f70] Update LEAF-Writer settings object
- [075e01f73cd9f199e2403a0bc922f2c09d1c1da7] Update localization
- [6df32a92882ed0bfa727cc2572f0d7c6c8897c83] replace dependency: react-router-dom -> react-router and make the necessary changes
- [4147045e1287f95c487de4ca3281bd7053fab9a3] improve accessibility
- [271ee888327093f403c58ee1f81ac593280905a3] Update dependencies
  - add: @cwrc/leafwriter-authority-service-lgpn [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
  - remove: react-router-dom [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
  - core:
    - upgrade:
      - chroma-js@3.1.2
      - date-fns@4.1.0
      - helmet@8.0.0
      - keycloak-js@26.1.2 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - uuid@11.0.5
    - update:
      - @analytics/google-analytics@1.1.0
      - @emotion/react@11.14.0
      - @emotion/styled@11.14.0
      - @fontsource/lato@5.1.1
      - @ts-rest/core@3.52.0 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - compression@1.8.0 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - express@4.21.2
      - framer-motion@11.18.2
      - i18next@23.16.8
      - jotai@2.12.0 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - material-ui-popup-state@5.3.3
      - react-dropzone@14.3.5
      - react-i18next@15.4.0
      - react-icons@5.4.0
      - react-use@17.6.0
      - swr@2.3.2 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - zod@2.24.2 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
    - bump:
      - @mui/icons-material@5.15.14
      - @mui/material@5.16.14
      - analytics@8.16.0 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - axios@1.7.9
      - compression@1.7.5
      - dexie@4.0.11
      - i18next-browser-languagedetector@8.0.2
      - mdi-material-ui@7.9.3 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - mui-modal-provider@2.4.6
      - notistack@3.0.2
      - query-string@9.1.1
      - react-markdown@9.0.3
  - dev:
    - upgrade:
      - @types/chroma-js@3.1.0
      - webpack-cli@5.0.1
      - webpackbar@7.0.0
    - update:
      - @octokit/types@13.8.0 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - @types/node@22.13.1 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - esbuild-loader@4.3.0 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - tsup@8.3.6
      - typescript@5.7.3
      - webpack@5.97.1
    - bump:
      - @types/chroma-js@3.1.1 [3243334bf668d7b0c3fed0c725734f2ed59536a7]
      - @types/dotenv-webpack@7.0.8
      - @types/react-dom@18.3.5
      - @types/webpack-env@1.18.6
      - eslint@8.57.1
      - html-webpack-plugin@5.6.3
      - less@4.2.2
      - mini-css-extract-plugin@2.9.2
      - @types/webpack-env@1.18.8 [3243334bf668d7b0c3fed0c725734f2ed59536a7]

## 3.5.1

### Minor Changes

- [19f3c894325398648a867384109f21cf978b56b5] add new UI/UX for bug reports

### Patch Changes

- [315407a7e97248a1d579b993055a6a37b2c9133e] authentication: switch auth state to UNAUTHENTICATED if LINCS API is unreachable
- [52dda7efdf5340e2f4d198bf27dacec3ecf00026] locales: format and remove unused terms
- Updated dependencies
  - core: bump: @cwrc/leafwriter@3.6.1

## 3.5.0

### Mahor Changes

- [ce7ab42dcac3e59202e92683435145b0517f7192] [144a99c91cee9526783b9dec1b57b2278b0bb02f] localization:
  - Add support to Portuguese, Spanish, Romanian, and German,

### Minor Changes

- [b96dc7d21a8a2efb2c326dd89383100e1fe87ce3] Edit page: use state to control leafwriter module

### Patch Changes

- [f0a2c696b98c6ed8b019ac40e57e191c1f866d43] Fix intermittent error while loading supported providers, wich prevent users to access their github account
- [631bd7c1a547a003a8bc82679e9201370f5ad956] redirect link for documentation
- [423bff9aa90440197619c351c98cb44af9fb0507] locale: add terms
- [a3d42dac8775bc03d5050ab0f3f4272942c81946] [b18f94469e67dbf2db063cf9c2518a17813ad625] UX: add message if auth server is not available
- [e7f0c2a0716787ad40e12f59b3c650c0070f0ed9] Improve DX: better type checking and error handling
- [c4a3c1dee2e7d0d4e6fc5bbc6836eaf246ebf098] Improve DX: extend button types and rename a property
- [8231788c0c8274be36f01fe175eeabe5f794c9b6] 18n: redefine nsSeparator as `.`
- [d6e4c610ca297401261212e3508b9eec6ade92b6] Replace onClick for onPointerDown
- [96a25fce655f054afee2fd2cc5fa9283819e13ca] mui: use slopProps instead of accessing props directly
- [ced9d4db357d7c8471eb1b52edc4db67ba07f1c2] update dependencies
  - core:
    - upgrade:
      - @cwrc/leafwriter-storage-service@4.0.0
      - i18next-browser-languagedetector@8.0.0
      - keycloak-js@25.0.2
      - react-i18next@15.0.1 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - uuid@10.0.0
    - update:
      - @cwrc/leafwriter@3.6.0
      - @emotion/react@11.13.0
      - @emotion/styled@11.13.0
      - @lincs.project/auth-api-contract@1.2.1
      - @mui/icons-material@5.16.7 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - @mui/lab@5.0.0-alpha.173 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - @mui/material@5.16.7
      - @octokit/rest@20.1.1
      - @ts-rest/core@3.49.2
      - axios@1.7.3 [76d4cb1dbb6de2d78601458e530b9bae4711d17f]
      - chroma-js@2.6.0
      - framer-motion@11.3.24 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - i18next@23.12.3 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - jotai@2.9.2 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - mdi-material-ui@7.9.1
      - query-string@9.1.0
      - react@18.3.1
      - react-dom@18.3.1
      - react-icons@5.2.1
      - react-router@7.1.5
      - zod@3.23.8
    - bump:
      - @octokit/rest@20.1.1
      - dexie@4.0.8
      - material-ui-popup-state@5.1.2
      - react-helmet-async@2.0.5
      - react-use@17.5.1
  - dev:
    - upgrade:
      - @types/node@22.1.2 [f0a2c696b98c6ed8b019ac40e57e191c1f866d43]
      - css-loader@7.1.2
      - css-minimizer-webpack-plugin@7.0.0
      - rimraf@6.0.1
    - update:
      - @octokit/types@13.5.0
      - @types/react-dom@18.3.0
      - esbuild-loader@4.2.2
      - mini-css-extract-plugin@2.9.0
      - tsup@8.2.4 [76d4cb1dbb6de2d78601458e530b9bae4711d17f]
      - typescript@5.5.4
      - webpack@5.93.0
    - bump:
      - @types/webpack-env@1.18.5

## 3.4.0

### Minor Changes

- [535a46761a292eb57ef482342726494d648ea857] remove template files: Person/Place/Organizations List (#209)

### Patch Changes

- [e80b5cfede5c352c97c37b7b9f163da31e92256c] Prevent showing settings button on the homepage (#206)
- [d223e9e6620b499dc116c2cf7f554e5201505d51] Main menu: Rename `download` as `Export Document`(#177)
- Updated dependencies
  - @cwrc/leafwriter-storage-service@3.1.0
  - @cwrc/leafwriter@3.5.0

### Chore

- [2e2972825b2ccaeae8f0df664f79f078c98c9d15] schemas (dev): incorporate more schemas for testing purposes
- update dependencies
  - core:
    - upgrade:
      - date-fns@3.6.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - dexie@4.0.4 [ff94486b8c8efcda6eccef691421f9ce6fa8397a]
      - framer-motion@11.0.27 [02eedc44b435ed093e2d70b4174000d7cced2194]
      - keycloak-js@24.0.2 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - query-string@9.0.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - react-i18next@14.0.7 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - react-icons@5.0.1 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
    - update:
      - @octokit/rest@20.1.0 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - @mui/icons-material@5.15.15 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - @mui/lab@5.0.0-alpha.170 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - @mui/material@5.15.15 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - @ts-rest/core@3.41.2 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - express@4.19.2 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - i18next@23.11.1 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - i18next-browser-languagedetector@7.2.1 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - jotai@2.8.0 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - loglevel@1.9.1 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - material-ui-popup-state@5.1.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - mdi-material-ui@7.8.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - mui-modal-provider@2.4.2 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - react-router-dom@6.22.3 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - react-use@17.5.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
    - bump:
      - @emotion/react@11.11.4 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - @emotion/styled@11.11.5 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - @fontsource/lato@5.0.20 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - analytics@0.8.11 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - axios@1.6.8 dexie@3.2.7 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - react-helmet-async@2.0.4 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - swr@2.2.5 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
  - dev:
    - upgrade:
      - @octokit/types@13.4.0 [5f7c0356046e7b2c643fa81d975fcefafd2a8a29]
      - copy-webpack-plugin@12.0.2 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - css-minimizer-webpack-plugin@6.0.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - less-loader@12.2.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - webpackbar@6.0.1 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
    - update:
      - @types/node@20.12.7
      - css-loader@6.10.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - esbuild-loader@4.1.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - eslint@8.57.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - html-webpack-plugin@2.8.1 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - webpack@5.91.0 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
    - bump:
      - @types/chroma-js@2.4.4 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - @types/react-dom@18.2.24
      - tsup@8.0.2 [a6593b7c742d17083e06b106cf1d8737e84fa4bd]
      - typescript@5.4.5 [02eedc44b435ed093e2d70b4174000d7cced2194]

## 3.3.1

### Patch Changes

- Maintenance
  - [1b7e3bb7731e76b57933e4d8691826c79199c7f5] Format
  - [b00a79acbd95189394f20ba67d9a382db8bda2ae] Coalesce tsconfig in the app
  - [c4478406d800e83b892c48bea026f537c68a17f5] Update dependencies
    - core
      - upgrade:
        - broadcast-channel@7.0.0
        - keycloak-js@23.0.1
        - react-helmet-async@2.0.1
      - update:
        - @cwrc/leafwriter@3.4.0
        - @mui/lab@5.0.0-alpha.154
        - helmet@7.1.0
        - i18next23.7.0
        - i18next-browser-languagedetector@7.2.0
        - jotai@2.6.0
        - react-i18next@13.5.0
        - react-icons@4.12.0
        - react-router-dom@6.20.0
      - bump:
        - @cwrc/leafwriter-storage-service@3.0.1
        - @lincs.project/auth-api-contract@1.0.3
        - @mui/icons-material@5.14.19
        - @ts-rest/core@3.30.5
        - axios@1.6.2
        - framer-motion@10.16.9
        - react-markdown@9.0.1
        - react-use@17.4.1
    - dev:
      - upgrade: tsup@8.0.1
      - update:
        - @octokit/types@12.3.0
        - @types/node@20.10.1
        - eslint@8.54.0
        - typescript@5.3.1
      - bump:
        - @types/chroma-js@2.4.3
        - @types/compression@1.7.5
        - types/dotenv-webpack@7.0.7
        - @types/express@4.17.21
        - @types/md5@2.3.5
        - @types/react-dom@18.2.17
        - @types/webpack@5.28.5
        - @types/webpack-env@1.18.4
        - @types/webpackbar@4.0.6

## 3.3.0

### Patch Changes

- [ecf5f7c211cb7889819e42c4cfc7355c42b930be] storageService: rename resource.ownertype to resource.ownerType

### Maintenance

- [cc99bf6056578c6dc1c5732dc3a9e8eecad30b86] reserve 'server' folder for production
- [467b92906093e277cc8b95869705b51c91df7086] move server code to foler 'src-server'
  - also remove 'webpack server-dev'
- [8c0779b88e383177d22b111c5a2ef48321741324] [83f8fc641638d12f38c3ee89cfb2536995102ee5] use tsup to build server code and node watch to start
  - drop nodemon dependency
- [e23ce2f99f35007e4c5ed7a8388d47f9e9796589] update dependencies
  - core:
    - upgrade:
      - broadcast-channel@6.0.0
      - @cwrc/leafwriter-storage-service@3.0.0 [3f9a8f33f7b4ea72a60ba32907652fa32a57e20f]
    - update: react-router-dom@6.18.0
    - bump:
      - @cwrc/leafwriter@3.3.1
      - @mui/icons-material@5.1.16
      - @mui/lab@5.0.0-alpha.151
      - @mui/material@5.15.16
      - dexie-react-hooks@1.1.7 |
  - dev:
    - remove:
      - @types/webpack-hot-middleware
      - history
      - nodemon
      - ts-loader
      - ts-node
      - tslib
      - webpack-bundle-analyzer
      - webpack-dev-middleware
      - webpack-hot-middleware
    - add:
      - @types/react-dom@18.2.14
      - rimraf@5.0.5
      - tsup@7.2.0
    - bump: @types/node@20.8.10

## 3.2.3

### Maintenance

- [af60589e08b8b1891010a2ef2234cb7dc07953b0] simplify tsconfig
  - `"forceConsistentCasingInFileNames": false` --> fix eslint crashing on mac
- [98f69959de2d8c7e2b16c9482c774e34e48d67e9] simplify webpack config
  - Since it is a mororepo, webpack can get files from sibiling packages instead of navigating through node_modules
- [c82d5e7c676abd2865de9ffc058ae28d7036bcc8] update dependencies
  - core:
    - update: axios@1.6.0
    - bump:
      - @fontsource/lato@5.0.17
      - @mui/icons-material5.14.15
      - @mui/lab@5.0.0-alpha.150
      - @mui/material@5.14.15
      - keycloak-js@22.0.5
  - dev:
    - update: @octokit/types@12.1.1
    - bump: @types/node@20.8.9

- Updated dependencies
- @cwrc/leafwriter@3.3.0
- @cwrc/leafwriter-storage-service@2.2.2

## 3.2.2

### Patch Changes

- [401453596f59e0ae5b6be83b163fc0b00de11482] import storageService from 'exports'
- saving
  - [21ac781069fa46e9997978dd50f2e6d0402c3e6e] address issue preventing the document to be updated in the local storage
  - [15172336ed6d7b9ad03e67dfc9c990f3369373f3] address issue preventing saving local files in the cloud (#164)
- [6cb3f53b473179b1002b656fdd571e23028667ec] storage: Do not allow load from url
  - This features needs to be implement on LW-Commons to work

### Maintenance

- linting, formating, typing
  - [c713a2f3553de1ddff446541b709c23bb0698695]
  - [93a10b4529de15147508e2632720bc60aadec7b9]
  - [42744c4accb25dec0518eeed7570f8883337f0c8]
  - [60a66740abe345dc6eb94011a14e987873ece693]
  - [61f5b3c0d4b0b754265bc94ff83ea3765676b92f]
  - [317c89e69f77edb43d3a8a47a90a9930916cacac]
- [e85b9115a6ebccc74199bf5577a426d6a69b7a1d] centralize tsconfig
- [dc0939ea602da8b06405f2e4ce6e82de19cda0fe] improve tsconfig: implicit import react
- [f3a03773d687fb620a8d8f160f408e23fbb99cb7] add scripts: lint & format
- [edf546a8282d56aa8c9558e2c6e7eda35d93276e] remove unnecessary files
  - changelog.config.js
  - issue_template.md
- [30adfc56eec0183a161d86062c10f86fcc121998] update esbuild to 4.0.2
- [ca1df10456603d7d75715c95b41a6de040b3e019] centralize linting and formating
- [cf97e093498b280a39b13b914e9f0bbb3d7640d9] update dependencies
  - core:
    - remove debug
    - upgrade: react-markdown@9.0.0
    - update:
      - @cwrc/leafwriter-storage-service@2.2.1
      - @mui/lab@5.0.0-alpha.149
      - @ts-rest/core@3.30.4
      - axios@1.5.1
      - broadcast-channel@5.5.1
      - framer-motion@10.16.4
      - i18next@23.6.0
      - jotai@2.5.0
      - mui-modal-provider@2.3.1
      - react-i18next@13.3.1
      - react-icons4.11.0
      - react-router-dom@6.17.0
    - bump:
      - @cwrc/leafwriter@3.2.3
      - @fontsource/lato@5.0.16
      - @mui/icons-material@5.14.14
      - @mui/material@5.14.14
      - @octokit/rest@20.0.2
      - keycloak-js@22.0.4
      - material-ui-popup-state@5.0.10
      - overmind-react@29.0.5
      - swr@2.2.4
      - zod@3.22.4
  - dev:
    - remove:
      - @typescript-eslint/eslint-plugin
      - @typescript-eslint/parser
    - add:
      - tslib@2.6.2
      - typescript@5.2.2
      - webpack@5.89.0
      - webpack-bundle-analyzer@4.9.1
    - upgrade: @octokit/types@12.0.0
    - update:
      - ts-loader@9.5.0
      - types/node@20.8.7
        bump:
        @types/chroma-js@2.4.2
        @types/compression@1.7.4
        @types/dotenv-webpack@7.0.6
        @types/express@4.17.20
        @types/md5@2.3.5
        @types/webpack@5.28.4
        @types/webpack-env@1.18.3
        @types/webpack-hot-middleware@2.25.8
        @types/webpackbar@4.0.5

## 3.2.1

### Patch Changes

- Permalink:
  - Handle 404 error [eaaa9895d15e52576f56ca04307e0e47ab55681c]
  - Fix url contructor [11cfe7953b326b8df61f371dc1997b631260e109]
- Auth-api:
  - simplify request call [28b43746c3e453e709edc6838a04b9404afb2e7b]
- Update dependencies [3f16648354282eaddb44ef2f508924ca4bf46cef]
  - core:
    - update: @ts-rest/core@3.27.0 jotai@2.3.1
    - bump:
      - @cwrc/leafwriter-storage-service@2.1.3
      - @cwrc/leafwriter@3.2.2
      - @fontsource/lato@5.0.8
      - @lincs.project/auth-api-contract@1.0.2
      - @mui/lab@5.0.0-alpha.139
      - @mui/material@5.14.4
      - framer-motion@10.15.1
      - i18next@23.4.2
      - vanilla-cookieconsent@2.9.2
  - dev:
    - upgrade: eslint-config-prettier@9.0.0
    - update:
      - @typescript-eslint/eslint-plugin@6.3.0
      - @typescript-eslint/parser@6.3.0
      - less@4.2.0
    - bump: @types/node@20.4.9

## 3.2.0

### Minor Changes

- Homepage
  - Add link and route to the About section [9a67962c6d5857dc88e5fce2992c399da07a14d5] [17c956a06c7fdf8aec509764e335ff69f0be9f31] (closes #158)

### Patch Changes

- API
  - Update auth-api endpoints [ef91d4da30b8d1ecd242dc8fee92e2183ba622a9] (closes #161)
- Localization
  - Fix localization path [ce5deb9101b46f80527a5529790f14934b936da1]

- Updated dependencies [acb5d910689603b9c1484e81428df63a69a99734]
  - core:
    - upgrade:
      - @octokit/rest@20.0.1
      - keycloak-js@22.0.1
    - update:
      - @fontsource/lato@5.0.7
      - @mui/icons-material@5.14.3
      - @mui/material@5.14.3
      - framer-motion@10.15.0
      - i18next@23.4.1
    - bump:
      - **@cwrc/leafwriter@3.2.1**
      - @mui/lab@5.0.0-alpha.138
      - jotai@2.2.3
      - react-i18next@13.0.3
      - react-router-dom@6.14.2
  - dev:
    - upgrade:
      - @octokit/types@11.1.0
      - @typescript-eslint/eslint-plugin@6.2.1
      - @typescript-eslint/parser@6.2.1
      - eslint-plugin-prettier@5.0.0
      - nodemon@3.0.1
    - update:
      - esbuild-loader@3.1.0
      - eslint@8.46.0
      - eslint-config-prettier@8.10.0
      - eslint-plugin-react@7.33.1
      - monaco-editor-webpack-plugin@7.1.0
    - bump:
      - @types/node@20.4.7
      - prettier@3.0.1
      - tslib@2.6.1
      - webpack@5.88.2

## 3.1.3

### Patch Changes

- Updated dependencies [d01baad72892b3366ecf3a528f64a10de293c117]
  - core: update: @cwrc/leafwriter@3.2.0

## 3.1.2

### Patch Changes

- Main menu: hide shortcuts (temporary measure) (#136) [931f6baefa9918d80447bc87577f8546c3ab5beb]
  - Not all shortcuts work and they are only for Mac. We should create variations to other OSs and heavily test them.
- SEO support (mitigation). Add tags 'title' and 'meta > description' to the page (#142) [0a74772fb81e30473319b6ad04e13794bb5a1d28]
- UI: truncate long document titles on the top bar and on the recent panel (#144) [12fbbe458b125bdabb506397c5785e1e4ad99bb6]
- Webpack: add fallback 'stream' [a91dae2b074848c518a058ce0dd3ad5d3b9b03c9]
- Update Dependencies [ba3c04eff5eb07b058cbff9d817410d791872a62]:
  - core:
    - upgrade:
      - @fontsource/lato@5.0.4
      - i18next@23.2.8
      - react-i18next@13.0.1
    - update:
      - @cwrc/leafwriter@3.1.0
      - @mui/icons-material@5.13.7
      - @mui/material@5.13.7
      - i18next-browser-languagedetector@7.1.0
      - jotai@2.2.2
      - react-icons@4.10.1
      - react-router-dom@6.14.1
      - swr@2.2.0
    - bump:
      - @analytics/cookie-utils@0.2.12
      - @analytics/google-analytics@1.0.7
      - @cwrc/leafwriter-storage-service@2.1.2
      - @emotion/react@11.11.1
      - @mui/base@5.0.0-beta.6
      - @mui/lab@5.0.0-alpha.135
      - @octokit/rest@19.0.13
      - analytics@0.8.9
      - dexie@3.2.4
      - dexie-react-hooks@1.1.6
      - framer-motion@10.12.18
      - keycloak-js@21.1.2
      - material-ui-popup-state@5.0.9
      - overmind@28.0.3
      - overmind-react@29.0.3
      - vanilla-cookieconsent@2.9.1
  - dev:
    - upgrade:
      - @octokit/types@10.0.0
      - @types/node@20.4.0
      - prettier@3.0.0
    - update:
      - @typescript-eslint/eslint-plugin@5.61.0
      - @typescript-eslint/parser@5.61.0
      - css-loader@6.8.1
      - tslib@2.6.0
      - typescript@5.1.6
      - webpack@5.88.1
      - webpack-bundle-analyzer@4.9.0
    - bump:
      - @types/dotenv-webpack@7.0.4
      - @types/webpack-env@1.18.1
      - css-minimizer-webpack-plugin@5.0.1
      - html-webpack-plugin@5.5.3
      - less-loader@11.1.3
      - mini-css-extract-plugin@2.7.6
      - ts-loader@9.4.4
      - webpack-cli@5.1.4
      - webpack-dev-middleware@6.1.1
      - webpack-hot-middleware@2.25.4

## 3.1.1

### Patch Changes

- Update dependencies [4838d80bb78670dd754dc657c6489ce0eafacf20]
  - core:
    - upgrade: helmet@7.0.0
    - update:
      - @emotion/react@11.11.0
      - @emotion/styled@11.11.0
      - axios@1.4.0
      - broadcast-channel@5.1.0
      - date-fns@2.30.0
      - jotai@2.1.0
      - keycloak-js@21.1.1
      - react-router-dom@6.11.1
      - vanilla-cookieconsent@2.9.0
    - bump:
      - @cwrc/leafwriter@3.0.1
      - @mui/material@5.12.3
      - framer-motion@10.12.8
      - i18next@22.4.15
      - js-cookie@@3.0.5
      - react-i18next@12.2.2
      - react-markdown@8.0.7
      - rxjs@7.8.1 swr@2.1.5
  - dev:
    - update:
      - @octokit/type@9.2.1
      - eslint@8.40.0
      - webpack@5.82.0
      - webpack-cli@5.1.0
      - webpack-dev-middleware@6.1.0
    - bump:
      - @typescript-eslint/eslint-plugin@5.59.2
      - @typescript-eslint/parser@5.59.2
      - prettier@2.8.8

## 3.1.0

### Notable Changes

#### Allow unauthenticated users to open public GitHub files

Unauthenticated users can open public documents using the LWC permalink. The document opens on either 'view' or 'edit' mode, but the user cannot save the document to the cloud. In fact, without authentication, it is impossible to save the file back to the repository).

### Minor Changes

- Allow unauthenticated users to open public GitHub files [309f21a0652aa865f0fd09cdafd9baec9f2e973f]

### Patch Changes

- Load document
  - Samples: fix bug preventing unauthenticated users from loading sample files [8ffc9f7a68b9bbb8a7fc02ae84b8fd796734f9a5]
  - From the cloud: fix bug preventing unauthenticated users from being redirected to the sign-in page [c4c056bac7dc77adf90e1ce56fb7df8334438198]
- Folder Structure
  - Rename 'view' as 'page' [3299cd98a14ef31eece7615f9c6c3e4d4fcf5c07]
  - Move Storage Dialog from Components to Dialog folder [05905fe4318d11e01f01c931badd33ec8f9c8aa5]
  - Move profile from components to views [e7b322a4b27d60d5e05db2e748cd8acee49dffad]
  - Move uploadDropBox from components to View [5f1d4034318f850d0fcfb7dc2f009dcd30527ed1]
- Types:
  - Permalink: better typing [9b9f47181d61fb9ee29811f6365c412648a78e38]
  - Tweaks [966e007679ee39de3ba87fd76329ccb880ad7eb9]
- Update dependencies
  - core:
    - bump: @cwrc/leafwriter-storage-service@2.1.1 [c885e7abba64e82a3550b7109cd95217713d3aa2]

## 3.0.0

### Notable Changes

#### Import and Export

In an effort to make LEAF-Writer more accessible, we are implementing Import from and Export to different formats. We started by adding support to import from `Transkribus` and export to `HTML`.

The conversion is made by an external service (`LEAF-TE`). LWC submit the document to LEAF-TE and receive back the converted document.

The options for both Import and Export are dynamically gathered from `LEAF-TE`. When new formats become available, LWC will show them without the need to redeploy the code, unless a more complex setup is needed.

##### Import

A document can be imported in two different flows: `Implicit` or `Explicit`

The `Implicit Flow` intercept the document a user is about to open. It checks for clues to see if it needs to convert the file (e.g., the presence of a specific tag). If LWC finds a signal that the document can be converted, it will prompt the user to select the appropriate action: open as is, or convert it.

In the `Explicit Flow`, the user clicks on the Import button to open the Import dialog. Then, the user selects the document format and the document to import.

##### Export

A document can be exported from the Main Menu when the document is opened. LW lists the possible formats in the option `download`. The user selects the format and downloads the converted document.

##### Open in a new tab

LWC opens documents in a new tab if you have a document already opened. This fix is a well know bug that prevented users from opening and replacing documents when another document is opened.

Now, any document opened from the home page opens in the same tab.
Documents open from the `edit` or `view` page open in a new tab.

It is still possible to close a document and open another in the same tab.

#### UI

There are some changes and improvements in the UI. Most notably the storage view (recent documents, samples, templates). The interaction changed slightly: now, one click selected the document. It needs a double click to open it.

### Major Changes

- Storage View:
  - One-click Selects. Double click open the document [d56031c7b57c757de520c293d65b802b19a7b64c] [198af8c6b79820cea469590cf89b924f3e23a589]
- Implicit import files
  - Show prompt when detecting special formats [06956667d5535250d6091929ce53c9529dd4f477]
- documentRequest
  - Temporarilly stores documents in the documentRequest table (indexedDB) to allow LEAF-Writer to open it in another browser tab. [1b6c26f3343540096fdb0534a98038c2c5fe53aa]
- Introduce import and export functionalities [043c8e7f5c4c8bffe89cc5e6ec08af6cc3a61fcf]
  - Add import/export dialog.
  - Redesign storage views.
  - Redesign the main menu.
  - Rework load resource logic.
  - Open documents on a new tab when a document is already opened. Connect with LEAF-TE API for file conversion.

### Minor Changes

- LEAF-Writer: Adopt new settings [394cdadda0327537dbee9a4396e993d46a79a90f]
- Sign out: Clear indexedDb [64e905fdc05eb1eef9a8f5afe1da19f30c2c75c5]
- Icons: Add support for multiple icon libraries [0b7036f7183aa0d5b8e8eb376a90ba6811fca656]
- Storage Service Dialog: use export instead of default [3086f039e2afe5de3fb135261d0a6157e399a650]

### Patch Changes

- Db:
  - Clean code [5c0a8b7b59caf8b1594d96b5c6be5267e90a614e]
  - Add try-catch block [027575484434e508c164875d655ac9217fff3663]
- Localization tweaks [2e94d3e1dc509f15fa2b99d01dc010e5cf1daa37] [1a86d429f0e10ed58ce06feab8ff735bec0683b8] [f864db4c22ffb279e8644c3e553021d09600f4fb]
- Events: Dispatch events when changing `language` or `theme` [d0007fe73e12aac9165b1b77bb47318d14173692]
- HTTP: Improve HTTP error handling and logging [a69a7712b4638614e98b4522b5a184ae7339f612]
- Clean code [40c2837166f43dec0bcdc15c0a237734a660603e] [f16e1dd10228a4f9b25ab83f52361d7aa22f1258]
- tsconfig: Step up `moduleResolution` to `nodenext` [1132da660acc09642fe456dbce0e7c0045d5ddb3]
- Update dependencies [05a6a18ab83e856c640b276c95ffbc147a283565]
  - core:
    - upgrade: [70044dc3ca38174e102cd18ed677023e1ab93b5b]
      - @cwrc/leafwriter@3.0.0
      - @cwrc/leafwriter-storage-service@2.1.0
    - update:
      - @mui/material@5.12.1
      - framer-motion@10.12.4 [70044dc3ca38174e102cd18ed677023e1ab93b5b]
      - helmet@6.1.5
    - bump:
      - @mui/lab@5.5.0-alpha.127
      - axios@1.3.5
  - dev:
    - add @types/webpackbar@4.0.3 [70044dc3ca38174e102cd18ed677023e1ab93b5b]
    - update:
      - @typescript-eslint/eslint-plugin@5.59.0
      - @typescript-eslint/parser@5.59.0
      - eslint@8.38.0
      - webpack@5.79.0
    - bump
      - html-webpack-plugin@5.5.1
      - typescript@5.0.4

## 2.7.0

### New Features

#### Import File

We are implementing `import files` on LEAF-Writer Commons. We are planning for two methods: an `Implicit` and an `Explicit` flow.

This version introduces the mechanics for the `Implicit flow` (in alpha).
When opening a file, LEAF-Writer Commons checks for clues to see if it needs to convert the file (e.g., the presence of a specific tag). These changes add the necessary checks and UX for converting from the `Transkribus-TEI` Output. This feature is still pending the connection to an external API to make the conversion.

#### Export File

We are implementing `export files` on LEAF-Writer Commons.

This version introduces the mechanics and UI for `export to HTML` (in alpha).
From the main menu, the user can export and download the XML document as an HTML file. This feature is still pending the connection to an external API to make the conversion.

#### Viewing Mode (Readonly)

When opening a document the user does not have write permission, LEAF-Writer will open in `viewing mode`. Users can switch to `edit mode` if they want to edit, make a pull request or download the document.

The route to the viewing mode changed slightly.

Instead of using the URL search query `&readonly=true)`, we use the route path `/view`.
Example:

Before: `https://localhost/edit?provider=github&owner=lucaju&ownertype=user&repo=cwrc-writer-samples&filename=Sample%20TEI%20letter%20-%20Original.xml&readoly=true`

After: `https://localhost/view?provider=github&owner=lucaju&ownertype=user&repo=cwrc-writer-samples&filename=Sample%20TEI%20letter%20-%20Original.xml`

#### File Browser

A slight change in the UX: one click selects the view. A subsequent click (or a double click) opens it.

### Minor Changes

- Import
  - Introduce Import Implicit Flow: Transkribus (alpha) [53aaadc736d814d99865c12503d24c21bb9a6b33]
- Export:
  - Introduce the mechanics and UI for export to HTML (alpha) [4db458797ed0da4d24699cebef48d0ee77b31f7c]
  - Available in production [9b54affefa216c85774b8b27c364f48fd0befe17]
- ReadOnly:
  - Open document in viewing mode (read-only) when a user does not have write permission [31da45affbbef2bac63dcb515f6c9896ceb6cbe2]
- Recent documents:
  - Move from local storage to indexedDB using Dexie

### Patch Changes

- File Browser (recent documents/sample/template):
  - Minor design changes [129a0aabc9bf1868048c99267b1b8174cc591afc]
- Routes
  - Use route '/view' for read-only mode
- HTTP Request error
  - Move and improve error handling [6ac549580e28bee525f94c18f4f51f8500a2f85c]
- Dialogs
  - Rename `title` as `label` [7745d58276178ed223e3160d3591f4306e63fd51]
  - Rename `Message` to `Body` [5f10bf0e0668e6997d4a711164b3ff23f976a092]
- Icons
  - Improve typing [be908627f0129e2eb0697202d87c9b2212a3acf0]
- Utilities
  - Move functions to dedicated modules [751d5c68d0e60f621f1b5b19db7d2f29ac0aab49]
- CSS:
  - Fix first-letter selector [088f89721506aa8de0ad3258e33447b71e0e7fc5]
- Types
  - Improve localStorage API to receive generic Type [438977a16d56706b681f0f5df71f4b02cb4830ef]
  - Clean [54655f682683c942fadb6f8348e83204b8946848] [5451628239e9f20cdd478dac8c96f7e852dc011e]
- Update Dependencies [61506d40cdee49f66743cb20c0d1e6c723a844a3]
  - core:
    - remove unused: body-parser cookie-parser
    - added: @mui/lab@5.0.0-alpha.125
    - upgrade: notistack@3.0.1
    - update:
      - @cwrc/leafwriter-storage-service@1.4.0 [efef759c1ed692cc695cf69238fb938f7705f287]
      - framer-motion@10.10.0
      - mdi-material-ui@7.7.0
      - react-router-dom@6.10.0
    - bump up:
      - @cwrc/leafwriter@2.7.4 [efef759c1ed692cc695cf69238fb938f7705f287]
      - @mui/icons-material@5.11.16
      - @mui/material@5.11.16
      - i18next@22.4.14
      - keycloak-js@21.0.2
  - dev:
  - remove: @types/react-responsive-masonry
  - upgrade: css-minimizer-webpack-plugin@5.0.0
  - update:
    - @typescript-eslint/eslint-plugin@5.57.1
    - @typescript-eslint/parser5.71.1
    - eslint@8.37.0 webpack@5.77.0
  - bump up:
    - @types/node@18.15.11
    - @types/webpack@5.18.1
    - typescript@5.0.3

## 2.6.6

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@2.7.3

## 2.6.5

### Patch Changes

- Updated dependencies
  - bump up: @cwrc/leafwriter@2.7.2

## 2.6.4

### Patch Changes

- Updated dependencies
  - bump up: @cwrc/leafwriter@2.7.1

## 2.6.3

### Patch Changes

- Autosave:
  - Prevent trigger save if the the editor return no content after the timer is up [2376e9b69c8c0d16d9a958889d207a16cb39ac3d] [eaf201d2f8fae806c7f06167702560295364ac1b]
- Update dependencies [ccae62554a51f86befa4b2bd864ffb4f642621cc]:
  - core:
    - upgrade: broadcast-channel@5.0.3
    - update:
      - @cwrc/leafwriter to 2.7.0 [eaf201d2f8fae806c7f06167702560295364ac1b]
      - framer-motion@10.9.1
    - bump up:
      - @mui/material@5.11.14
      - i18next@22.4.13
      - material-ui-popup-state@5.0.8
      - react-markdown@8.0.6
  - dev:
    - upgrade: typescript@5.0.2
    - update:
      - @typescript-eslint/eslint-plugin@5.56.0
      - @typescript-eslint/parser@5.56.0
      - eslint-config-prettier@8.8.0
    - bump up:
      - @types/node@18.15.10 [eaf201d2f8fae806c7f06167702560295364ac1b]
      - mini-css-extract-plugin@2.7.5
      - nodemon@2.0.22
      - webpack@5.76.3
      - webpack-dev-middleware@6.0.2

## 2.6.2

### Patch Changes

- Fix EsbuildPlugin minify config [00d1b753915e8acf2557cf0f1ab0b913a336f586]
- Update dependencies [bb2064f17c06f9a46caf17c7f4d8a3aafc3b28af]
  - core:
    - update: framer-motion@10.3.2
    - bump up: @mui/material@5.11.13
  - dev:
    - bump up:
      - @types/node@18.15.3
      - webpack@5.76.2

## 2.6.1

### Patch Changes

- Add / remove types [778aa1b49207c9d64bf45d75222a92f0b28925c7]
- Limit react-route to `react-route-dom` [3e5cb24d96e5fe0ef229dbc6c07d4275f11928e9]
- Use `REACT.NODE` from `REACT` instead of markdown [c2d10f0fc988aa887b83a51367a6c89b0e25e68f]
- Simplify css properties in mui components [a98d5bf7d760f8d1b085cf2c06ec3c681c010ea5]
- Update dependencies [b993ce85428a4b41ad9153782315f9a4d85040c4]:
  - core:
  - remove unnecessary: @mui/lab
  - add missing: rxjs@7.8.0
  - upgrade:
    - framer-motion@10.2.4
    - keycloak-js@21.0.1
    - query-string@8.1.0
    - react-markdown@8.0.5
  - update:
    - react-i18next@12.2.0
    - react-router-dom@6.9.0
    - zod@3.21.4
  - bump up:
    - @emotion/react@11.10.6
    - @emotion/styled@11.0.6
    - @mui/icons-material@5.11.11
    - @mui/material@5.11.12
    - axios@1.3.4
    - body-parser@1.20.2
    - i18next@22.4.11
  - dev:
    - add missing: @octokit/types@9.0.0
    - update:
      - @types/chroma-js@2.4.0
      - @types/node@18.5.0
      - @typescript-eslint/eslint-plugin@5.54.1
      - @typescript-eslint/parser@5.54.1
      - eslint@3.36.0
      - webpack@5.76.1
    - bump up:
      - mini-css-extract-plugin@2.7.3
      - nodemon@2.0.21

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
