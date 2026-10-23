import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { SellerAuthGuard } from "../auth/auth.guard";
import { CurrentSeller } from "../auth/current-seller.decorator";
import { ProductsService } from "./products.service";
import { CreateProductDto, UpdateProductDto } from "./products.dto";

@Controller("products")
@UseGuards(SellerAuthGuard)
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService
  ) {}

  @Get()
  async getProducts(@CurrentSeller() seller: any) {
    return this.productsService.getProductsBySeller(seller.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @CurrentSeller() seller: any,
    @Body() body: CreateProductDto
  ) {
    return this.productsService.createProduct(seller.id, body);
  }

  @Patch(":id")
  async updateProduct(
    @CurrentSeller() seller: any,
    @Param("id") id: string,
    @Body() body: UpdateProductDto
  ) {
    return this.productsService.updateProduct(seller.id, id, body);
  }

  @Delete(":id")
  async deleteProduct(@CurrentSeller() seller: any, @Param("id") id: string) {
    return this.productsService.deleteProduct(seller.id, id);
  }
}
