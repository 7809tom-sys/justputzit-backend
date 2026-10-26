CREATE TABLE `city_activity_refreshes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(32),
  `last_refreshed_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `city_activity_refreshes_id` PRIMARY KEY(`id`)
);
