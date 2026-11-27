import { DataSource } from 'typeorm';

export const TEST_DATABASE_NAME = 'conduit_test';

const EXCLUDED_TABLES = new Set(['migrations']);

interface TableRow {
  tableName: string;
}

/**
 * Guard against accidentally truncating a non-test database (such as the dev `conduit` DB).
 */
export function assertTestDatabase(dataSource: DataSource): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Refusing to mutate database outside test environment (NODE_ENV=${String(process.env.NODE_ENV)}).`,
    );
  }

  const database = dataSource.options.database;
  if (database !== TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing to truncate database "${String(database)}". Expected "${TEST_DATABASE_NAME}".`,
    );
  }
}

/**
 * Truncates every application table in `conduit_test` (excluding `migrations`)
 * on a single MySQL connection so `FOREIGN_KEY_CHECKS` stays session-scoped.
 */
export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  assertTestDatabase(dataSource);

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const rows = (await queryRunner.query(
      `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [TEST_DATABASE_NAME],
    )) as TableRow[];

    const tablesToTruncate = rows
      .map((row) => row.tableName)
      .filter((name) => !EXCLUDED_TABLES.has(name));

    if (tablesToTruncate.length === 0) {
      return;
    }

    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const tableName of tablesToTruncate) {
        await queryRunner.query(`TRUNCATE TABLE \`${tableName}\``);
      }
    } finally {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  } finally {
    await queryRunner.release();
  }
}
