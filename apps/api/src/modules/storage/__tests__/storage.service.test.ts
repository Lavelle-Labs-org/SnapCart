import { describe, it, expect, beforeEach } from "vitest";
import { StorageService, validateImageMagicBytes } from "../storage.service";
import * as fs from "node:fs";
import * as path from "node:path";

describe("StorageService & Magic Byte Sniffing", () => {
  it("correctly identifies valid JPEG magic bytes", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = validateImageMagicBytes(jpegBuffer);
    expect(res.isValid).toBe(true);
    expect(res.mimeType).toBe("image/jpeg");
    expect(res.ext).toBe("jpg");
  });

  it("correctly identifies valid PNG magic bytes", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const res = validateImageMagicBytes(pngBuffer);
    expect(res.isValid).toBe(true);
    expect(res.mimeType).toBe("image/png");
    expect(res.ext).toBe("png");
  });

  it("correctly identifies valid WebP magic bytes", () => {
    // RIFF....WEBP
    const webpBuffer = Buffer.from("RIFFxxxxWEBPVP8 ");
    const res = validateImageMagicBytes(webpBuffer);
    expect(res.isValid).toBe(true);
    expect(res.mimeType).toBe("image/webp");
    expect(res.ext).toBe("webp");
  });

  it("rejects malicious or invalid executables / text disguised as images", () => {
    const fakeImage = Buffer.from("<html><script>alert(1)</script></html>");
    const res = validateImageMagicBytes(fakeImage);
    expect(res.isValid).toBe(false);
  });

  it("rejects empty or truncated buffer", () => {
    const tiny = Buffer.from([0xff, 0xd8]);
    const res = validateImageMagicBytes(tiny);
    expect(res.isValid).toBe(false);
  });

  describe("uploadProductImage fallback & size enforcement", () => {
    let service: StorageService;

    beforeEach(() => {
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      service = new StorageService();
    });

    it("rejects files exceeding max size limit", async () => {
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      hugeBuffer[0] = 0xff;
      hugeBuffer[1] = 0xd8;
      hugeBuffer[2] = 0xff;

      await expect(
        service.uploadProductImage({
          buffer: hugeBuffer,
          originalName: "large.jpg",
          sellerId: "seller_1",
          productId: "prod_1",
        })
      ).rejects.toThrow("File size exceeds maximum allowed limit");
    });

    it("rejects invalid file format during upload", async () => {
      const textBuffer = Buffer.from("Hello plain text not image");
      await expect(
        service.uploadProductImage({
          buffer: textBuffer,
          originalName: "test.txt",
          sellerId: "seller_1",
          productId: "prod_1",
        })
      ).rejects.toThrow("Invalid file format");
    });

    it("uploads and saves valid JPEG in local fallback mode", async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00]);
      const res = await service.uploadProductImage({
        buffer: validJpeg,
        originalName: "coffee.jpg",
        sellerId: "seller_test_123",
        productId: "prod_test_456",
      });

      expect(res.imageUrl).toContain("/uploads/products/seller_test_123/product_prod_test_456_");
      expect(res.imageUrl).toMatch(/\.jpg$/);

      // Verify file exists on disk
      const localPath = path.resolve(process.cwd(), "public", res.imageUrl.replace(/^\//, ""));
      expect(fs.existsSync(localPath)).toBe(true);

      // Test delete
      await service.deleteProductImage(res.imageUrl);
      expect(fs.existsSync(localPath)).toBe(false);
    });
  });
});
