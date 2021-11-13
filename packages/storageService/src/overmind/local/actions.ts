import { Context } from '../';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const uploadFile = async ({ state }: Context, file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        return resolve(event.target.result);
      }
      reject(null);
    };

    reader.onerror = (error) => {
      console.warn(file, error);
      reject(null);
    };

    reader.readAsText(file);
  });
};

type Resource = {
  content: string;
  filename?: string;
};

export const setResource = async ({ state }: Context, { content, filename }: Resource) => {
  if (!content) return null;
  state.common.resource = state.common.source === 'local' ? { content, filename } : { content };
};
