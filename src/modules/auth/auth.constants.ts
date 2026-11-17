export const BCRYPT_SALT_ROUNDS = 10;
export const AUTH_HEADER_TOKEN_SCHEME = 'Token';
export const AUTH_HEADER_BEARER_SCHEME = 'Bearer';

// Field length constants (used across DTOs, entities, and validation messages)
export const USERNAME_MIN_LENGTH = 1;
export const USERNAME_MAX_LENGTH = 50;
export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // Bcrypt maximum effective password length is 72 bytes
export const BIO_MAX_LENGTH = 1000;
export const IMAGE_URL_MAX_LENGTH = 500;
