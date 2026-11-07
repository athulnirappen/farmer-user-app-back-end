export type StoredFile = {
  key: string;
  url: string;
};

export interface StorageProvider {
  save: (name: string, contents: Buffer, contentType: string) => Promise<StoredFile>;
  remove: (key: string) => Promise<void>;
}
