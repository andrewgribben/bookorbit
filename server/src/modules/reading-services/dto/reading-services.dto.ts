import { IsObject, IsString, MinLength, registerDecorator, ValidationOptions } from 'class-validator';

import { READING_SERVICE_FEATURES, type ReadingServiceFeature } from '@bookorbit/types';

const KNOWN_FEATURES: readonly string[] = READING_SERVICE_FEATURES;

function IsReadingServiceFeatureMap(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isReadingServiceFeatureMap',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
          return Object.entries(value as Record<string, unknown>).every(([key, v]) => KNOWN_FEATURES.includes(key) && typeof v === 'boolean');
        },
        defaultMessage() {
          return `${propertyName} must only contain known reading-service feature keys with boolean values`;
        },
      },
    });
  };
}

export class UpdateReadingServiceFeaturesDto {
  @IsObject()
  @IsReadingServiceFeatureMap()
  features!: Partial<Record<ReadingServiceFeature, boolean>>;
}

/** Body for `POST /reading-services/:provider/auth/token` (the `token` auth method). */
export class ConnectTokenDto {
  @IsString()
  @MinLength(1)
  credential!: string;
}
