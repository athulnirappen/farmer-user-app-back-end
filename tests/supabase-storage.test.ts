import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseStorageProvider } from '../src/shared/storage/supabase.provider.js';

const provider = createSupabaseStorageProvider({
  url: 'https://project.supabase.co/',
  serviceRoleKey: 'service-key',
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
      Authorization: 'Bearer service-key',
      'Content-Type': 'image/png',
    });
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
