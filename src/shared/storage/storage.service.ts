import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import { env } from '../../config/env.js';
import { localStorageProvider } from './local.provider.js';
import { createSupabaseStorageProvider } from './supabase.provider.js';

const provider =
  env.STORAGE_PROVIDER === 'supabase'
    ? createSupabaseStorageProvider({
        url: env.SUPABASE_URL!,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY!,
        bucket: env.SUPABASE_STORAGE_BUCKET,
      })
    : localStorageProvider;

const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

// Works out the type from the file's first bytes; the type an uploader declares can be anything
const imageExtension = (file: Buffer): keyof typeof CONTENT_TYPES | null => {
  if (file.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (
    file.subarray(0, 4).toString('latin1') === 'RIFF' &&
    file.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
};

export const saveImage = (file: Buffer) => {
  const extension = imageExtension(file);

  if (!extension) {
    throw new AppError('Upload a JPEG, PNG or WebP image', 400);
  }

  return provider.save(`${randomUUID()}.${extension}`, file, CONTENT_TYPES[extension]);
};

export const removeImage = (key: string) => provider.remove(key);
