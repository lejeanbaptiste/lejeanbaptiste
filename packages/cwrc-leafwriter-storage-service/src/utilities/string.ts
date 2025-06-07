export const isValidHttpURL = (value: string) => {
  const res = /^http(s)?:\/\/[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,6}(\/\S*)?$/.exec(value);
  return res !== null;
};
