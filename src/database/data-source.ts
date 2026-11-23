import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Attachment } from '../modules/attachments/entities/attachment.entity.js';
import { Follow } from '../modules/profiles/entities/follow.entity.js';
import { User } from '../modules/users/entities/user.entity.js';

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `Missing required environment variable for DataSource: ${envVar}`,
    );
  }
}

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4_unicode_ci',
  entities: [User, Attachment, Follow],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
