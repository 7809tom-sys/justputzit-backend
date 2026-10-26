ALTER TABLE `bookings` ADD COLUMN `rescheduleRequestedFor` timestamp NULL;
ALTER TABLE `bookings` ADD COLUMN `rescheduleRequestNote` text NULL;
ALTER TABLE `bookings` ADD COLUMN `rescheduleRequestedAt` timestamp NULL;
