import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import {
  CreateBusinessDto,
  CreateProductDto,
  UpdateBusinessDto,
  UpdateProductDto,
} from './businesses.dto';
import { BusinessesService } from './businesses.service';

/**
 * Owner-facing business routes. They live under `/my-businesses` on purpose:
 * the public `GET /businesses/:id` (content module) would otherwise swallow
 * `GET /businesses/mine` and hand it to `ParseIntPipe` — the same routing trap
 * `GET /ads/favorites` had to dodge in Phase 6.
 */
@Controller()
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Active business categories for the registration form (public). */
  @Public()
  @Get('business-categories')
  categories(): ReturnType<BusinessesService['categories']> {
    return this.businesses.categories();
  }

  /** Register a new business (auth) — starts PENDING + FREE, tier via payment. */
  @Post('businesses')
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessDto,
  ): ReturnType<BusinessesService['create']> {
    return this.businesses.create(user, dto);
  }

  /** The caller's own businesses, any moderation status («کسب‌وکارهای من»). */
  @Get('my-businesses')
  mine(@CurrentUser() user: User): ReturnType<BusinessesService['mine']> {
    return this.businesses.mine(user);
  }

  /** One owned business with its menu rows (owner only — others get 404). */
  @Get('my-businesses/:id')
  manage(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): ReturnType<BusinessesService['manage']> {
    return this.businesses.manage(user, id);
  }

  /** Edit the public profile fields of an owned business. */
  @Patch('my-businesses/:id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBusinessDto,
  ): ReturnType<BusinessesService['update']> {
    return this.businesses.update(user, id, dto);
  }

  /** Add one menu/product row (name, group, price, photo). */
  @Post('my-businesses/:id/products')
  addProduct(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductDto,
  ): ReturnType<BusinessesService['addProduct']> {
    return this.businesses.addProduct(user, id, dto);
  }

  /** Edit one menu/product row. */
  @Patch('my-businesses/:id/products/:productId')
  updateProduct(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
  ): ReturnType<BusinessesService['updateProduct']> {
    return this.businesses.updateProduct(user, id, productId, dto);
  }

  /** Remove one menu/product row. */
  @Delete('my-businesses/:id/products/:productId')
  removeProduct(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
  ): ReturnType<BusinessesService['removeProduct']> {
    return this.businesses.removeProduct(user, id, productId);
  }
}
