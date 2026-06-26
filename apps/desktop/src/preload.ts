import { contextBridge, ipcRenderer } from 'electron';

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

const electronAPI: ElectronAPI = {
  openProjectFolder: () => ipcRenderer.invoke('openProjectFolder'),
  readDirectory: (dirPath: string, options?: { allFiles?: boolean }) =>
    ipcRenderer.invoke('readDirectory', dirPath, options),
  readFile: (filePath: string) => ipcRenderer.invoke('readFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('writeFile', filePath, content),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
