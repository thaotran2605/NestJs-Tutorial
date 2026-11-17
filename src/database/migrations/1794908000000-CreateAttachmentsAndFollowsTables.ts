import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachmentsAndFollowsTables1794908000000
  implements MigrationInterface
{
  name = 'CreateAttachmentsAndFollowsTables1794908000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`attachments\` (\`id\` varchar(36) NOT NULL, \`entity_type\` varchar(50) NOT NULL, \`entity_id\` int NOT NULL, \`file_name\` varchar(255) NOT NULL, \`file_type\` varchar(100) NOT NULL, \`file_size\` int NOT NULL, \`url\` varchar(500) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_attachments_entity\` (\`entity_type\`, \`entity_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`follows\` (\`follower_id\` int NOT NULL, \`following_id\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_follows_following_id\` (\`following_id\`), PRIMARY KEY (\`follower_id\`, \`following_id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`follows\` ADD CONSTRAINT \`FK_follows_follower_id\` FOREIGN KEY (\`follower_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`follows\` ADD CONSTRAINT \`FK_follows_following_id\` FOREIGN KEY (\`following_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`follows\` DROP FOREIGN KEY \`FK_follows_following_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`follows\` DROP FOREIGN KEY \`FK_follows_follower_id\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_follows_following_id\` ON \`follows\``,
    );
    await queryRunner.query(`DROP TABLE \`follows\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_attachments_entity\` ON \`attachments\``,
    );
    await queryRunner.query(`DROP TABLE \`attachments\``);
  }
}
