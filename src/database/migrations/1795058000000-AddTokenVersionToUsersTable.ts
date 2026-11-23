import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenVersionToUsersTable1795058000000
  implements MigrationInterface
{
  name = 'AddTokenVersionToUsersTable1795058000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`token_version\` int NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`token_version\``,
    );
  }
}
