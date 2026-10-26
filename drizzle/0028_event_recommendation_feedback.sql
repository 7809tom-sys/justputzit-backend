CREATE TABLE `event_recommendation_feedback` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `event_id` int NOT NULL,
  `interview_session_id` int,
  `response` enum('interested','not_for_me') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `event_recommendation_feedback_id` PRIMARY KEY(`id`)
);
