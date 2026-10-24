const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "../apps/web/.next");
const dest = path.resolve(__dirname, "../.next");

if (fs.existsSync(src)) {
  try {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    try {
      fs.symlinkSync(src, dest, "junction");
      console.log("[prepare-vercel] Successfully symlinked apps/web/.next to .next");
    } catch {
      fs.cpSync(src, dest, { recursive: true });
      console.log("[prepare-vercel] Successfully copied apps/web/.next to .next");
    }
  } catch (err) {
    console.warn("[prepare-vercel] Warning:", err.message);
  }
}
