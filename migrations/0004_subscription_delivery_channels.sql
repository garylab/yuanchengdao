ALTER TABLE subscription_deliveries ADD COLUMN email_delivered_at TEXT;
ALTER TABLE subscription_deliveries ADD COLUMN telegram_delivered_at TEXT;

UPDATE subscription_deliveries
SET email_delivered_at = delivered_at,
    telegram_delivered_at = delivered_at
WHERE email_delivered_at IS NULL AND telegram_delivered_at IS NULL;
