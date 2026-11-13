-- Script tự động tạo database conduit và conduit_test khi MySQL khởi động lần đầu
CREATE DATABASE IF NOT EXISTS `conduit` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS `conduit_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
FLUSH PRIVILEGES;
