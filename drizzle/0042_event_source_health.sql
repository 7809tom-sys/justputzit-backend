CREATE TABLE `event_source_health` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sourceKey` VARCHAR(100) NOT NULL UNIQUE,
  `sourceLabel` VARCHAR(160) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `status` ENUM('healthy', 'empty', 'failed') NOT NULL DEFAULT 'empty',
  `eventsFound` INT NOT NULL DEFAULT 0,
  `errorMessage` TEXT NULL,
  `lastAttemptedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastSucceededAt` TIMESTAMP NULL
);
