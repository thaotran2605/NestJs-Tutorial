import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity.js';

const DEFAULT_DB_PORT = 3306;

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || DEFAULT_DB_PORT,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'conduit',
  charset: 'utf8mb4_unicode_ci',
  entities: [User],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
