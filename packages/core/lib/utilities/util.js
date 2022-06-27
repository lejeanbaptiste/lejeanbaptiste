export const supportedLanguages = new Map([
    ['en-CA', { code: 'en-CA', name: 'english', shortName: 'en' }],
    ['fr-CA', { code: 'fr-CA', name: 'french', shortName: 'fr' }],
]);
export function isErrorMessage(param) {
    return param.message !== undefined;
}
//# sourceMappingURL=util.js.map