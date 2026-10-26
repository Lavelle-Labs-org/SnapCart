import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { ProductsController } from "./products.controller";
import { StorefrontController } from "./storefront.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [ProductsController, StorefrontController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
