import { Controller, Get, Query } from '@nestjs/common';
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
}
