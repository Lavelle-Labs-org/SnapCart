// On Vercel frontend deployments, skip building NestJS API backend
if (process.env.VERCEL) {
  console.log('✔ Vercel deployment detected: skipping NestJS API build.');
  process.exit(0);
}

const { execSync } = require('child_process');
execSync('npm run build:contracts && npm --workspace=@order-by-sms/api run build', {
  stdio: 'inherit',
});
