export function validateEnv(config: Record<string, unknown>) {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
    'REDIS_HOST',
    'REDIS_PORT',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
  ];

  const missingVars = requiredEnvVars.filter((key) => !config[key]);

  if (missingVars.length > 0) {
    throw new Error(
      `[ConfigError] Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`,
    );
  }

  return config;
}
