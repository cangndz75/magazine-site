export type MediaObjectPutInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type MediaObjectStore = {
  put(input: MediaObjectPutInput): Promise<void>;
  delete(key: string): Promise<void>;
};
