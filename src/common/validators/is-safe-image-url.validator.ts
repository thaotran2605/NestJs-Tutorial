import {
  isURL,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

const SAFE_LOCAL_AVATAR_PATH_REGEX =
  /^\/uploads\/avatars\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i;

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_valid_protocol: true,
  require_tld: false,
};

export function isSafeImageUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  if (SAFE_LOCAL_AVATAR_PATH_REGEX.test(value)) {
    return true;
  }

  return isURL(value, HTTP_URL_OPTIONS);
}

export function IsSafeImageUrl(validationOptions?: ValidationOptions) {
  return function registerSafeImageUrl(
    object: object,
    propertyName: string,
  ): void {
    registerDecorator({
      name: 'isSafeImageUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: 'errors.USER_INVALID_IMAGE_URL',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return isSafeImageUrl(value);
        },
      },
    });
  };
}
