export const getSourceNameFromUrl = (url: string) => {
  const Url = new URL(url);
  const domain = Url.hostname
    .replace('www.', '')
    .replace('vocab.', '')
    .replace('.edu', '')
    .replace('.org', '');
  return domain;
};

export const certaintyOptions = ['high', 'medium', 'low', 'unknown'] as const;
