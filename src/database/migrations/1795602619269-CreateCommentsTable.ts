import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCommentsTable1795602619269 implements MigrationInterface {
    name = 'CreateCommentsTable1795602619269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`comments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`body\` text NOT NULL, \`article_id\` int NOT NULL, \`author_id\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_comments_author_id\` (\`author_id\`), INDEX \`IDX_comments_article_created\` (\`article_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`comments\` ADD CONSTRAINT \`FK_e9b498cca509147e73808f9e593\` FOREIGN KEY (\`article_id\`) REFERENCES \`articles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`comments\` ADD CONSTRAINT \`FK_e6d38899c31997c45d128a8973b\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`comments\` DROP FOREIGN KEY \`FK_e6d38899c31997c45d128a8973b\``);
        await queryRunner.query(`ALTER TABLE \`comments\` DROP FOREIGN KEY \`FK_e9b498cca509147e73808f9e593\``);
        await queryRunner.query(`DROP INDEX \`IDX_comments_article_created\` ON \`comments\``);
        await queryRunner.query(`DROP INDEX \`IDX_comments_author_id\` ON \`comments\``);
        await queryRunner.query(`DROP TABLE \`comments\``);
    }

}
