export const getFileExtension = (filename: string) => {
  return filename.split('.').pop() ?? '';
};

export const getFileNameWithoutExtension = (filename: string) => {
  const extension = getFileExtension(filename);
  return filename.slice(0, -(extension.length + 1));
};

export const renameFileAsCopy = (filename: string) => {
  const extension = getFileExtension(filename);
  const name = getFileNameWithoutExtension(filename);
  return `${name}_(copy).${extension}`;
};

export const changeFileExtension = (filename: string, newExternsion: string) => {
  const name = getFileNameWithoutExtension(filename);
  return `${name}.${newExternsion}`;
};
