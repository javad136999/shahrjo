import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { CityContentQueryDto } from './content.dto';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  /** Published news of one city. */
  @Public()
  @Get('news')
  news(@Query() query: CityContentQueryDto): ReturnType<ContentService['news']> {
    return this.content.news(query.city, query.limit);
  }

  /** Approved, non-expired ads of one city. */
  @Public()
  @Get('ads')
  ads(@Query() query: CityContentQueryDto): ReturnType<ContentService['ads']> {
    return this.content.ads(query.city, query.limit);
  }

  /** Approved businesses of one city (showcase order). */
  @Public()
  @Get('businesses')
  businesses(@Query() query: CityContentQueryDto): ReturnType<ContentService['businesses']> {
    return this.content.businesses(query.city, query.limit);
  }

  /** One published news article (Phase 6) — counts a view. */
  @Public()
  @Get('news/:slug')
  newsDetail(@Param('slug') slug: string): ReturnType<ContentService['newsDetail']> {
    return this.content.newsDetail(slug);
  }

  /** One approved business profile (Phase 6) — counts a view. */
  @Public()
  @Get('businesses/:id')
  businessDetail(@Param('id', ParseIntPipe) id: number): ReturnType<ContentService['businessDetail']> {
    return this.content.businessDetail(id);
  }
}
