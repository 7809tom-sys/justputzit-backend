ALTER TABLE `bookings` ADD COLUMN `stripeCheckoutSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD COLUMN `stripePaymentIntentId` varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_stripeCheckoutSessionId_unique` ON `bookings` (`stripeCheckoutSessionId`);
