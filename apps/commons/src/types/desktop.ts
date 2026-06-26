export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ElectronAPI {
  openProjectFolder: () => Promise<{ rootPath: string } | null>;
  readDirectory: (dirPath: string, options?: { allFiles?: boolean }) => Promise<FileEntry[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.electronAPI;
