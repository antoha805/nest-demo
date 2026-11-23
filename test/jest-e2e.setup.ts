process.env.LOG_LEVEL = 'silent';
process.env.DB_NAME = 'nest_demo_test';
process.env.JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-e2e';
// HTTPS, as the OAuth metadata refuses an http issuer other than localhost.
process.env.APP_URL = 'https://app.test';
process.env.MAIL_MAILER = 'log';
// Keeps the test run's jobs apart from the app's.
process.env.QUEUE_PREFIX = 'e2e';
