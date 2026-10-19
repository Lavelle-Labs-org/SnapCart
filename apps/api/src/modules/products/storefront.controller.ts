import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { StorefrontDto } from "@order-by-sms/contracts";

@Controller("s")
export class StorefrontController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * GET /api/s/:slug
   * Public storefront catalog endpoint.
   * Returns seller info and available products (available: true, deleted_at: null).
   */
  @Get(":slug")
  @HttpCode(HttpStatus.OK)
  async getStorefront(@Param("slug") slug: string): Promise<StorefrontDto> {
    const seller = await this.prisma.seller.findUnique({
      where: { slug },
    });

    if (!seller) {
      throw new NotFoundException(`Storefront with slug "${slug}" not found`);
    }

    const products = await this.prisma.product.findMany({
      where: {
        seller_id: seller.id,
        available: true,
        deleted_at: null,
      },
      orderBy: { created_at: "asc" },
    });

    return {
      seller: {
        id: seller.id,
        businessName: seller.business_name,
        smsName: seller.sms_name,
        phone: seller.phone,
        slug: seller.slug,
        createdAt: seller.created_at ? new Date(seller.created_at).toISOString() : new Date().toISOString(),
      },
      products: products.map((p) => ({
        id: p.id,
        sellerId: p.seller_id,
        name: p.name,
        priceSantim: p.price_santim,
        available: p.available,
        createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
      })),
    };
  }
}
