import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CitySummary {
  id: number;
  name: string;
  slug: string;
  isFeatured: boolean;
  latitude: number | null;
  longitude: number | null;
  province: { id: number; name: string; slug: string };
}

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active cities of active provinces for the first-run selection screen.
   * Featured cities come first; everything else is alphabetical.
   * City data lives only in the DB (multi-city rule: never hard-code).
   */
  async listActive(): Promise<CitySummary[]> {
    return this.prisma.city.findMany({
      where: { isActive: true, province: { isActive: true } },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        latitude: true,
        longitude: true,
        province: { select: { id: true, name: true, slug: true } },
      },
    });
  }
}
