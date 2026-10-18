import { z } from "zod";
import type { ProductDto } from "@order-by-sms/contracts";
import { toSantim } from "@order-by-sms/contracts";
import { HttpException, HttpStatus } from "@nestjs/common";

export const CreateProductSchema = z
  .object({
    name: z
      .string({ required_error: "Product name is required" })
      .trim()
      .min(1, { message: "Product name cannot be empty" })
      .max(100, { message: "Product name cannot exceed 100 characters" }),
    priceSantim: z.number().optional(),
    price_santim: z.number().optional(),
    priceBirr: z.number().optional(),
    price_birr: z.number().optional(),
    available: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      const price =
        data.priceSantim ??
        data.price_santim ??
        data.priceBirr ??
        data.price_birr;
      return typeof price === "number" && !Number.isNaN(price) && price > 0;
    },
    {
      message: "Price must be a positive number greater than 0",
      path: ["priceSantim"],
    }
  );

export const UpdateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Product name cannot be empty" })
      .max(100, { message: "Product name cannot exceed 100 characters" })
      .optional(),
    priceSantim: z.number().optional(),
    price_santim: z.number().optional(),
    priceBirr: z.number().optional(),
    price_birr: z.number().optional(),
    available: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const price =
        data.priceSantim ??
        data.price_santim ??
        data.priceBirr ??
        data.price_birr;
      if (price === undefined) return true;
      return typeof price === "number" && !Number.isNaN(price) && price > 0;
    },
    {
      message: "Price must be a positive number greater than 0",
      path: ["priceSantim"],
    }
  );

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export function resolveSantimPrice(
  input: {
    priceSantim?: number;
    price_santim?: number;
    priceBirr?: number;
    price_birr?: number;
  }
): number {
  if (input.priceBirr !== undefined || input.price_birr !== undefined) {
    const birr = (input.priceBirr ?? input.price_birr)!;
    if (typeof birr !== "number" || Number.isNaN(birr) || birr <= 0) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: "Price must be a positive number",
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return toSantim(birr);
  }

  const santim = input.priceSantim ?? input.price_santim;
  if (
    typeof santim !== "number" ||
    Number.isNaN(santim) ||
    !Number.isFinite(santim) ||
    santim <= 0
  ) {
    throw new HttpException(
      {
        code: "VALIDATION_ERROR",
        message: "Price must be a positive integer in Santim",
      },
      HttpStatus.BAD_REQUEST
    );
  }

  return Math.round(santim);
}

export function toProductDto(p: any): ProductDto {
  const createdAtIso =
    p.created_at instanceof Date
      ? p.created_at.toISOString()
      : typeof p.created_at === "string"
      ? p.created_at
      : new Date().toISOString();

  const deletedAtIso = p.deleted_at
    ? p.deleted_at instanceof Date
      ? p.deleted_at.toISOString()
      : typeof p.deleted_at === "string"
      ? p.deleted_at
      : null
    : null;

  return {
    id: p.id,
    sellerId: p.seller_id,
    seller_id: p.seller_id,
    name: p.name,
    priceSantim: p.price_santim,
    price_santim: p.price_santim,
    available: Boolean(p.available),
    createdAt: createdAtIso,
    created_at: createdAtIso,
    deletedAt: deletedAtIso,
    deleted_at: deletedAtIso,
  };
}
