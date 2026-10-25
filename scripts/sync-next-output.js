const fs = require('fs');
const path = require('path');

const webNext = path.resolve(__dirname, '../apps/web/.next');
const rootNext = path.resolve(__dirname, '../.next');

if (fs.existsSync(webNext)) {
  try {
    if (fs.existsSync(rootNext)) {
      try {
        fs.rmSync(rootNext, { recursive: true, force: true });
      } catch (_) {}
    }
    // Always perform a physical recursive copy so Vercel bundler finds actual directory at root/.next
    fs.cpSync(webNext, rootNext, { recursive: true });
    console.log('✔ Successfully copied apps/web/.next to root .next directory');
  } catch (err) {
    console.warn('[sync-next-output] Could not copy .next output directory:', err);
  }
}
