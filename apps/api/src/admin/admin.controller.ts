import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, RequirePermissions } from '../common/decorators';
// Value import (incl. DTOs): `import type` would erase them from
// design:paramtypes and ValidationPipe would never run on these bodies.
import { AdminService, BoundaryDto, BusinessDecisionDto, DecisionDto } from './admin.service';
import { UploadsService } from '../uploads/uploads.service';
import { AnalyticsService } from '../analytics/analytics.service';

/**
 * Admin panel API (Phase 8). Every route carries @RequirePermissions so the
 * global PermissionsGuard rejects non-operators before the handler runs;
 * AdminService additionally narrows queries to the operator's city/province.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly uploads: UploadsService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Queue counters for the panel home. */
  @Get('overview')
  @RequirePermissions('dashboard.view')
  overview(@CurrentUser() user: User) {
    return this.admin.overview(user);
  }

  /** Site visits: daily (today + last 30 days), monthly, yearly — Phase 13. */
  @Get('analytics/visits')
  @RequirePermissions('dashboard.view')
  visits() {
    return this.analytics.stats();
  }

  /** Ad moderation queue: ?status=PENDING|APPROVED|REJECTED (default PENDING). */
  @Get('ads')
  @RequirePermissions('ads.view')
  ads(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.admin.ads(user, status ?? 'PENDING');
  }

  @Post('ads/:id/approve')
  @RequirePermissions('ads.moderate')
  approveAd(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.admin.approveAd(user, id);
  }

  @Post('ads/:id/reject')
  @RequirePermissions('ads.moderate')
  rejectAd(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: DecisionDto) {
    return this.admin.rejectAd(user, id, dto);
  }

  /** Business queue: ?status=PENDING|APPROVED|REJECTED (default PENDING). */
  @Get('businesses')
  @RequirePermissions('businesses.view')
  businesses(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.admin.businesses(user, status ?? 'PENDING');
  }

  /** Approve + optionally pin the map location (both coordinates or neither). */
  @Post('businesses/:id/approve')
  @RequirePermissions('businesses.moderate')
  approveBusiness(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BusinessDecisionDto,
  ) {
    return this.admin.approveBusiness(user, id, dto);
  }

  @Post('businesses/:id/reject')
  @RequirePermissions('businesses.moderate')
  rejectBusiness(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.admin.rejectBusiness(user, id, dto);
  }

  /** Paid subscriptions waiting for approval (ZarinPal PENDING_REVIEW). */
  @Get('subscriptions')
  @RequirePermissions('subscriptions.manage')
  subscriptions(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.admin.subscriptions(user, status ?? 'PENDING_REVIEW');
  }

  @Post('subscriptions/:id/approve')
  @RequirePermissions('subscriptions.manage')
  approveSubscription(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.admin.approveSubscription(user, id);
  }

  @Post('subscriptions/:id/reject')
  @RequirePermissions('subscriptions.manage')
  rejectSubscription(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.admin.rejectSubscription(user, id, dto);
  }

  /** City map outline (GeoJSON Polygon; null clears) — Phase 9. */
  @Post('cities/:id/boundary')
  @RequirePermissions('map.manage')
  setCityBoundary(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BoundaryDto,
  ) {
    return this.admin.setCityBoundary(user, id, dto);
  }

  /** Disk usage of uploaded images (Phase 9 — the disk-fill guard). */
  @Get('storage/overview')
  @RequirePermissions('storage.manage')
  storageOverview() {
    return this.uploads.overview();
  }

  /** Run the orphan/cleanup sweep now; returns removed files + freed bytes. */
  @Post('storage/sweep')
  @RequirePermissions('storage.manage')
  storageSweep() {
    return this.uploads.sweep();
  }
}
