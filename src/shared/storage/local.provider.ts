import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { StorageProvider } from './storage.types.js';

export const UPLOADS_PATH = '/uploads';

// Keeps files on this machine; for local development and single-server hosting. Urls are relative to
// the API's address. Names come from storage.service.ts, never from the uploader.
export const localStorageProvider: StorageProvider = {
  save: async (name, contents) => {
    await mkdir(env.UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(env.UPLOADS_DIR, name), contents);
    return { key: name, url: `${UPLOADS_PATH}/${name}` };
  },
  remove: async (key) => {
    await rm(path.join(env.UPLOADS_DIR, key), { force: true });
  },
};
