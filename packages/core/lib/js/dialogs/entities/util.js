export const getSourceNameFromUrl = (url) => {
    const Url = new URL(url);
    const domain = Url.hostname
        .replace('www.', '')
        .replace('vocab.', '')
        .replace('.edu', '')
        .replace('.org', '');
    return domain;
};
//# sourceMappingURL=util.js.map