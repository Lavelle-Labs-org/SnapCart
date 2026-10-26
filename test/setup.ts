// Ensure predictable defaults in test runner regardless of developer's local .env
process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_PHONE_MAX = "5";
process.env.RATE_LIMIT_PHONE_WINDOW_SECONDS = "3600";
process.env.RATE_LIMIT_IP_MAX = "10";
process.env.RATE_LIMIT_IP_WINDOW_SECONDS = "3600";
process.env.RATE_LIMIT_OTP_COOLDOWN_SECONDS = "60";
process.env.RATE_LIMIT_OTP_EXPIRY_SECONDS = "300";
process.env.RATE_LIMIT_PICKUP_CODE_MAX_ATTEMPTS = "5";
process.env.RATE_LIMIT_IMAGE_UPLOADS_MAX = "30";
process.env.RATE_LIMIT_IMAGE_UPLOADS_WINDOW_SECONDS = "3600";
