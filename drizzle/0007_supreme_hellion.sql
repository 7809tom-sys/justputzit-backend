ALTER TABLE `user_profiles` ADD `claimedCity` varchar(100);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `gpsVerifiedLat` varchar(20);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `gpsVerifiedLng` varchar(20);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `gpsVerifiedCity` varchar(100);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `gpsVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `locationVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifyToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifyExpires` timestamp;