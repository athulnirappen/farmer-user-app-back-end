import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseStorageProvider } from '../src/shared/storage/supabase.provider.js';

const legacyKey = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';

const provider = createSupabaseStorageProvider({
  url: 'https://project.supabase.co/',
  serviceRoleKey: legacyKey,
  bucket: 'product-images',
});

const mockFetch = (status: number) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Supabase storage provider', () => {
  it('uploads to the bucket and returns the public url', async () => {
    const fetchMock = mockFetch(200);

    const saved = await provider.save('a.png', Buffer.from('image'), 'image/png');

    expect(saved).toEqual({
      key: 'a.png',
      url: 'https://project.supabase.co/storage/v1/object/public/product-images/a.png',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/storage/v1/object/product-images/a.png');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${legacyKey}`,
      apikey: legacyKey,
      'Content-Type': 'image/png',
    });
  });

  it('ignores a path pasted after the project url', async () => {
    const fetchMock = mockFetch(200);
    const pasted = createSupabaseStorageProvider({
      url: 'https://project.supabase.co/rest/v1/',
      serviceRoleKey: legacyKey,
      bucket: 'product-images',
    });

    const saved = await pasted.save('a.png', Buffer.from('image'), 'image/png');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://project.supabase.co/storage/v1/object/product-images/a.png'
    );
    expect(saved.url).toBe(
      'https://project.supabase.co/storage/v1/object/public/product-images/a.png'
    );
  });

  it('sends a new-style secret key only as apikey, not as a Bearer token', async () => {
    const fetchMock = mockFetch(200);
    const secret = createSupabaseStorageProvider({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'sb_secret_abc123',
      bucket: 'product-images',
    });

    await secret.save('a.png', Buffer.from('image'), 'image/png');

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.apikey).toBe('sb_secret_abc123');
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('fails the upload when storage rejects it', async () => {
    mockFetch(403);

    await expect(provider.save('a.png', Buffer.from('image'), 'image/png')).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('deletes the object and ignores one that is already gone', async () => {
    const fetchMock = mockFetch(404);

    await expect(provider.remove('a.png')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('fails the delete on other errors', async () => {
    mockFetch(500);

    await expect(provider.remove('a.png')).rejects.toMatchObject({ statusCode: 502 });
  });
});
