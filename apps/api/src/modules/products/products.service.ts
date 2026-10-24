import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProductDto } from "@order-by-sms/contracts";
import {
  CreateProductSchema,
  UpdateProductSchema,
  resolveSantimPrice,
  toProductDto,
} from "./products.dto";

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getProductsBySeller(sellerId: string): Promise<ProductDto[]> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        seller_id: sellerId,
        deleted_at: null,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    return products.map(toProductDto);
  }

  async createProduct(sellerId: string, input: any): Promise<ProductDto> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const parseResult = CreateProductSchema.safeParse(input);
    if (!parseResult.success) {
      const firstError =
        ((parseResult.error as any).issues?.[0]?.message ||
          (parseResult.error as any).errors?.[0]?.message) ||
        "Invalid input";
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: firstError,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const price_santim = resolveSantimPrice(input);

    const created = await this.prisma.product.create({
      data: {
        seller_id: sellerId,
        name: parseResult.data.name,
        price_santim,
        available: parseResult.data.available ?? true,
      },
    });

    return toProductDto(created);
  }

  async updateProduct(
    sellerId: string,
    productId: string,
    input: any
  ): Promise<ProductDto> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.deleted_at !== null) {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: "Product not found",
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (existing.seller_id !== sellerId) {
      throw new HttpException(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to modify this product",
        },
        HttpStatus.FORBIDDEN
      );
    }

    const parseResult = UpdateProductSchema.safeParse(input);
    if (!parseResult.success) {
      const firstError =
        ((parseResult.error as any).issues?.[0]?.message ||
          (parseResult.error as any).errors?.[0]?.message) ||
        "Invalid input";
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: firstError,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const data: Record<string, any> = {};

    if (parseResult.data.name !== undefined) {
      data.name = parseResult.data.name;
    }

    const hasPriceField =
      input?.priceSantim !== undefined ||
      input?.price_santim !== undefined ||
      input?.priceBirr !== undefined ||
      input?.price_birr !== undefined;

    if (hasPriceField) {
      data.price_santim = resolveSantimPrice(input);
    }

    if (parseResult.data.available !== undefined) {
      data.available = parseResult.data.available;
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data,
    });

    return toProductDto(updated);
  }

  async deleteProduct(
    sellerId: string,
    productId: string
  ): Promise<{ deleted: boolean; id: string }> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.deleted_at !== null) {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: "Product not found",
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (existing.seller_id !== sellerId) {
      throw new HttpException(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to delete this product",
        },
        HttpStatus.FORBIDDEN
      );
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        deleted_at: new Date(),
      },
    });

    return {
      deleted: true,
      id: productId,
    };
  }
}
