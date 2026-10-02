import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { CitiesService } from './cities.service';

@Controller('cities')
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  /** Public: the city list is needed before login (first-run selection). */
  @Public()
  @Get()
  list(): ReturnType<CitiesService['listActive']> {
    return this.cities.listActive();
  }
}
