export const ATTACHMENT_ENTITY_TYPE_USER = 'User';

export const ATTACHMENT_ENTITY_TYPE_MAX_LENGTH = 50;
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 255;
export const ATTACHMENT_FILE_TYPE_MAX_LENGTH = 100;
export const ATTACHMENT_URL_MAX_LENGTH = 500;

export const MAX_AVATAR_FILE_SIZE = 2097152; // 2MB in bytes
export const MAX_AVATAR_FILES_COUNT = 1;

export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const AVATAR_UPLOAD_SUBDIR = 'uploads/avatars';
export const PUBLIC_DIR_NAME = 'public';
