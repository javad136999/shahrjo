import type { PrismaService } from '../prisma/prisma.service';
import { CitiesService } from './cities.service';

function makeService() {
  const prisma = { city: { findMany: jest.fn() } };
  const service = new CitiesService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('CitiesService.listActive', () => {
  it('returns only active cities of active provinces, featured first', async () => {
    const { service, prisma } = makeService();
    const rows = [
      {
        id: 1,
        name: 'شهر نمونه',
        slug: 'sample-city',
        isFeatured: true,
        latitude: 27.8,
        longitude: 51.9,
        province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
      },
    ];
    prisma.city.findMany.mockResolvedValue(rows);

    const result = await service.listActive();

    expect(result).toEqual(rows);
    expect(prisma.city.findMany).toHaveBeenCalledWith({
      where: { isActive: true, province: { isActive: true } },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      select: expect.objectContaining({
        id: true,
        slug: true,
        province: { select: { id: true, name: true, slug: true } },
      }),
    });
  });

  it('never returns inactive cities or cities of inactive provinces', async () => {
    const { service, prisma } = makeService();
    prisma.city.findMany.mockResolvedValue([]);

    const result = await service.listActive();

    expect(result).toEqual([]);
    const args = prisma.city.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ isActive: true, province: { isActive: true } });
  });
});
