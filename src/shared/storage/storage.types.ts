export type StoredFile = {
  key: string;
  url: string;
};

export interface StorageProvider {
  save: (name: string, contents: Buffer) => Promise<StoredFile>;
  remove: (key: string) => Promise<void>;
}
