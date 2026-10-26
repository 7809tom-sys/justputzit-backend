CREATE TABLE IF NOT EXISTS sponsored_placements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL,
  venue_id INT NOT NULL,
  purchaser_user_id INT NOT NULL,
  package_code ENUM('week', 'month') NOT NULL,
  amount_cents INT NOT NULL,
  status ENUM('checkout_pending', 'active', 'expired', 'cancelled') NOT NULL DEFAULT 'checkout_pending',
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  stripe_checkout_session_id VARCHAR(255) NULL UNIQUE,
  stripe_payment_intent_id VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX sponsored_placements_activity_status_idx (activity_id, status),
  INDEX sponsored_placements_owner_idx (purchaser_user_id)
);
