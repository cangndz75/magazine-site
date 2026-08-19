/** Client-safe sort tokens — must match @magazine/db editor media library sorts. */
export const MEDIA_LIBRARY_SORT = {
  CREATED_DESC: "created_desc",
  CREATED_ASC: "created_asc",
  FILENAME_ASC: "filename_asc",
  FILENAME_DESC: "filename_desc",
  EXPIRES_ASC: "expires_asc",
} as const;
