import { Context } from '../';
import { log } from '../../utilities/log';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const uploadFile = async (_context: Context, file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        return resolve(event.target.result);
      }
      reject(null);
    };

    reader.onerror = (error) => {
      log.warn(file, error);
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
  if (!content) return;
  state.common.resource = state.common.source === 'local' ? { content, filename } : { content };
};
