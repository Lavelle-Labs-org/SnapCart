import {
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

export interface UploadImageOptions {
  buffer: Buffer;
  originalName: string;
  sellerId: string;
  productId: string;
}

export interface UploadImageResult {
  imageUrl: string;
  storageKey: string;
}

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Validates file buffer magic bytes to ensure the uploaded file is a genuine image.
 */
export function validateImageMagicBytes(buffer: Buffer): { isValid: boolean; mimeType?: string; ext?: string } {
  if (!buffer || buffer.length < 12) {
    return { isValid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, mimeType: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, mimeType: "image/png", ext: "png" };
  }

  // WebP: RIFF ... WEBP
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return { isValid: true, mimeType: "image/webp", ext: "webp" };
  }

  // AVIF: ....ftypavif or ....ftypavis
  if (buffer.length >= 16) {
    const ftyp = buffer.subarray(4, 8).toString("ascii");
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (ftyp === "ftyp" && (brand === "avif" || brand === "avis" || brand === "mif1")) {
      return { isValid: true, mimeType: "image/avif", ext: "avif" };
    }
  }

  return { isValid: false };
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicDomain: string;
  private readonly maxFileSizeBytes: number;
  private readonly isMockStorage: boolean;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || "order-by-sms";
    this.publicDomain = (
      process.env.R2_PUBLIC_DOMAIN ||
      process.env.NEXT_PUBLIC_R2_DOMAIN ||
      "http://localhost:4000/uploads"
    ).replace(/\/$/, "");

    this.maxFileSizeBytes = parseInt(
      process.env.R2_MAX_FILE_SIZE_BYTES || "5242880", // 5MB
      10
    );

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isMockStorage = false;
      this.logger.log(`[Storage] Initialized Cloudflare R2 client (Bucket: ${this.bucketName})`);
    } else {
      this.s3Client = null;
      this.isMockStorage = true;
      this.logger.log(
        "[Storage] R2 credentials not configured. Running in local fallback mode (uploads stored locally)."
      );
    }
  }

  /**
   * Uploads and sanitizes a product image. Returns the public CDN URL.
   */
  async uploadProductImage(options: UploadImageOptions): Promise<UploadImageResult> {
    const { buffer, sellerId, productId } = options;

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException("Image file cannot be empty");
    }

    if (buffer.length > this.maxFileSizeBytes) {
      const maxMb = Math.round(this.maxFileSizeBytes / (1024 * 1024));
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of ${maxMb}MB`
      );
    }

    const inspection = validateImageMagicBytes(buffer);
    if (!inspection.isValid || !inspection.mimeType || !inspection.ext) {
      throw new BadRequestException(
        "Invalid file format. Only JPEG, PNG, WebP, and AVIF image files are permitted."
      );
    }

    const uniqueSuffix = randomBytes(4).toString("hex");
    const sanitizedFilename = `product_${productId}_${Date.now()}_${uniqueSuffix}.${inspection.ext}`;
    const storageKey = `products/${sellerId}/${sanitizedFilename}`;

    if (this.s3Client && !this.isMockStorage) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: storageKey,
            Body: buffer,
            ContentType: inspection.mimeType,
            CacheControl: "public, max-age=31536000, immutable",
          })
        );

        const imageUrl = `${this.publicDomain}/${storageKey}`;
        this.logger.log(`Uploaded image to R2: ${storageKey}`);
        return { imageUrl, storageKey };
      } catch (err: any) {
        this.logger.error(`Failed to upload to Cloudflare R2: ${err.message}`, err.stack);
        throw new BadRequestException("Failed to upload image to storage service");
      }
    }

    // Local / Dev Fallback
    const localDir = path.resolve(process.cwd(), "public", "uploads", "products", sellerId);
    fs.mkdirSync(localDir, { recursive: true });
    const localFilePath = path.join(localDir, sanitizedFilename);
    fs.writeFileSync(localFilePath, buffer);

    const imageUrl = `/uploads/products/${sellerId}/${sanitizedFilename}`;
    this.logger.log(`Saved local fallback image: ${imageUrl}`);
    return { imageUrl, storageKey };
  }

  /**
   * Deletes an image from storage given its URL or storage key.
   */
  async deleteProductImage(imageUrlOrKey: string): Promise<void> {
    if (!imageUrlOrKey) return;

    // Extract storage key if a full URL is provided
    let storageKey = imageUrlOrKey;
    if (imageUrlOrKey.startsWith("http://") || imageUrlOrKey.startsWith("https://")) {
      try {
        const parsed = new URL(imageUrlOrKey);
        storageKey = parsed.pathname.replace(/^\//, "");
      } catch {
        // use as-is
      }
    } else if (imageUrlOrKey.startsWith("/uploads/")) {
      storageKey = imageUrlOrKey.replace(/^\/uploads\//, "");
    }

    if (this.s3Client && !this.isMockStorage) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: storageKey,
          })
        );
        this.logger.log(`Deleted image from R2: ${storageKey}`);
      } catch (err: any) {
        this.logger.warn(`Could not delete image from R2: ${err.message}`);
      }
      return;
    }

    // Local cleanup
    try {
      const localFilePath = path.resolve(process.cwd(), "public", "uploads", storageKey);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        this.logger.log(`Deleted local file: ${localFilePath}`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not delete local file: ${err.message}`);
    }
  }
}
