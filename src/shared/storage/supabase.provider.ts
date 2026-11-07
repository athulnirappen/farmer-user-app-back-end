import { AppError } from '../errors/app-error.js';
import { StorageProvider } from './storage.types.js';

type SupabaseStorageOptions = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

// Keeps images in a public Supabase Storage bucket, so they survive restarts and redeploys of
// hosts like Render whose disk is wiped. Urls are absolute.
export const createSupabaseStorageProvider = ({
  url,
  serviceRoleKey,
  bucket,
}: SupabaseStorageOptions): StorageProvider => {
  const base = url.replace(/\/+$/, '');
  const objectUrl = (name: string) => `${base}/storage/v1/object/${bucket}/${name}`;
  const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

  return {
    save: async (name, contents, contentType) => {
      const response = await fetch(objectUrl(name), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': contentType },
        body: new Uint8Array(contents),
      });

      if (!response.ok) {
        throw new AppError(`Image storage failed (${response.status})`, 502);
      }

      return { key: name, url: `${base}/storage/v1/object/public/${bucket}/${name}` };
    },
    remove: async (key) => {
      const response = await fetch(objectUrl(key), { method: 'DELETE', headers });

      // Already gone is fine; Supabase reports a missing object as 400 or 404
      if (!response.ok && response.status !== 404 && response.status !== 400) {
        throw new AppError(`Image removal failed (${response.status})`, 502);
      }
    },
  };
};
