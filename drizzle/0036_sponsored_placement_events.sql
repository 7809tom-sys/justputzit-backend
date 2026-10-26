CREATE TABLE `sponsored_placement_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `placement_id` int NOT NULL,
  `activity_id` int NOT NULL,
  `user_id` int NOT NULL,
  `event_type` enum('view','click','sign_up') NOT NULL,
  `event_day` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `sponsored_placement_events_id` PRIMARY KEY(`id`)
);

CREATE INDEX `sponsored_placement_events_placement_id_idx` ON `sponsored_placement_events` (`placement_id`);
CREATE INDEX `sponsored_placement_events_activity_id_idx` ON `sponsored_placement_events` (`activity_id`);
CREATE INDEX `sponsored_placement_events_user_day_idx` ON `sponsored_placement_events` (`placement_id`, `user_id`, `event_type`, `event_day`);
