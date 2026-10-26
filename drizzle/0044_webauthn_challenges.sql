CREATE TABLE `webauthn_challenges` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `purpose` enum('registration','authentication') NOT NULL,
  `challenge` varchar(512) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `webauthn_challenges_id` PRIMARY KEY(`id`),
  CONSTRAINT `webauthn_challenges_user_purpose_unique` UNIQUE(`userId`,`purpose`)
);
