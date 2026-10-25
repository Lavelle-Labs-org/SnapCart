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
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      fs.symlinkSync(webNext, rootNext, type);
      console.log('✔ Successfully linked apps/web/.next to root .next');
    } catch (_) {
      fs.cpSync(webNext, rootNext, { recursive: true });
      console.log('✔ Successfully copied apps/web/.next to root .next');
    }
  } catch (err) {
    console.warn('[sync-next-output] Could not sync .next output directory:', err);
  }
}
