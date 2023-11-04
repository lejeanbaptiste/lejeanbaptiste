export const isValidHttpURL = (value: string) => {
  const res = value.match(/^http(s)?:\/\/[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,6}(\/\S*)?$/);
  return res !== null;
};
