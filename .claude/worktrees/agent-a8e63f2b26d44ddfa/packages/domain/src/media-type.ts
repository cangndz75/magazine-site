export const MEDIA_TYPE = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
} as const;

export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];

export const MEDIA_TYPES = [
  MEDIA_TYPE.IMAGE,
  MEDIA_TYPE.VIDEO,
  MEDIA_TYPE.AUDIO,
] as const;
