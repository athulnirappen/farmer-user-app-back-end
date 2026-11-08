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
  // Only the project origin matters; tolerates a pasted API url like https://<ref>.supabase.co/rest/v1/
  const base = new URL(url).origin;
  const objectUrl = (name: string) => `${base}/storage/v1/object/${bucket}/${name}`;
  // Legacy service_role keys are JWTs and go in both headers. New `sb_secret_` keys are not JWTs:
  // Supabase rejects them as a Bearer token (400), so they go in `apikey` only.
  const isJwt = serviceRoleKey.split('.').length === 3;
  const headers: Record<string, string> = isJwt
    ? { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey }
    : { apikey: serviceRoleKey };

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
