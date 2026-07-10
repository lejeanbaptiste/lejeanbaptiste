export const isMacOS = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;

  return userAgentData?.platform
    ? userAgentData.platform === 'macOS'
    : /Mac/i.test(navigator.userAgent);
};
