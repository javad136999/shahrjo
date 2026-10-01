// ShahrJo seed - Phase 1.
// Idempotent: safe to run multiple times (upsert by slug/code).
// Cities are data, never hard-coded in the app; admins can add more later.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const provinces = [
  { name: 'بوشهر', slug: 'bushehr' },
  { name: 'فارس', slug: 'fars' },
];

const cities = [
  { province: 'bushehr', name: 'جم', slug: 'jam', latitude: 27.83, longitude: 52.32, featured: true },
  { province: 'bushehr', name: 'عسلویه', slug: 'asaluyeh', latitude: 27.48, longitude: 52.6, featured: true },
  { province: 'bushehr', name: 'کنگان', slug: 'kangan', latitude: 27.89, longitude: 52.49, featured: false },
  { province: 'bushehr', name: 'بوشهر', slug: 'bushehr-city', latitude: 28.97, longitude: 50.84, featured: true },
  { province: 'fars', name: 'شیراز', slug: 'shiraz', latitude: 29.59, longitude: 52.58, featured: true },
  { province: 'fars', name: 'جهرم', slug: 'jahrom', latitude: 28.5, longitude: 53.56, featured: false },
  { province: 'fars', name: 'لار', slug: 'lar', latitude: 27.69, longitude: 54.3, featured: false },
];

const roles = [
  { code: 'SUPER_ADMIN', title: 'مدیر کل' },
  { code: 'PROVINCE_ADMIN', title: 'مدیر استان' },
  { code: 'CITY_ADMIN', title: 'مدیر شهر' },
  { code: 'MODERATOR', title: 'ناظر' },
  { code: 'BUSINESS_OWNER', title: 'صاحب کسب‌وکار' },
  { code: 'USER', title: 'کاربر' },
];

const permissions = [
  { code: 'dashboard.view', title: 'مشاهده داشبورد' },
  { code: 'users.view', title: 'مشاهده کاربران' },
  { code: 'users.manage', title: 'مدیریت کاربران' },
  { code: 'provinces.manage', title: 'مدیریت استان‌ها' },
  { code: 'cities.manage', title: 'مدیریت شهرها' },
  { code: 'ads.view', title: 'مشاهده آگهی‌ها' },
  { code: 'ads.create', title: 'ایجاد آگهی' },
  { code: 'ads.moderate', title: 'تایید/رد آگهی' },
  { code: 'businesses.view', title: 'مشاهده کسب‌وکارها' },
  { code: 'businesses.create', title: 'ایجاد کسب‌وکار' },
  { code: 'businesses.moderate', title: 'تایید/رد کسب‌وکار' },
  { code: 'news.manage', title: 'مدیریت اخبار' },
  { code: 'chat.moderate', title: 'نظارت بر چت' },
  { code: 'reports.handle', title: 'رسیدگی به گزارش‌ها' },
  { code: 'banners.manage', title: 'مدیریت بنرها' },
  { code: 'map.manage', title: 'مدیریت مکان‌های نقشه' },
  { code: 'roles.manage', title: 'مدیریت نقش‌ها' },
  { code: 'audit.view', title: 'مشاهده لاگ ممیزی' },
];

const allPermissionCodes = permissions.map((p) => p.code);

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: allPermissionCodes,
  PROVINCE_ADMIN: [
    'dashboard.view', 'users.view', 'users.manage',
    'ads.view', 'ads.moderate',
    'businesses.view', 'businesses.moderate',
    'news.manage', 'chat.moderate', 'reports.handle',
    'banners.manage', 'map.manage', 'audit.view',
  ],
  CITY_ADMIN: [
    'dashboard.view', 'users.view',
    'ads.view', 'ads.moderate',
    'businesses.view', 'businesses.moderate',
    'news.manage', 'chat.moderate', 'reports.handle',
    'banners.manage', 'map.manage',
  ],
  MODERATOR: [
    'dashboard.view', 'ads.view', 'ads.moderate',
    'businesses.view', 'businesses.moderate',
    'chat.moderate', 'reports.handle',
  ],
  BUSINESS_OWNER: ['ads.view', 'ads.create', 'businesses.view', 'businesses.create'],
  USER: ['ads.view', 'ads.create'],
};

const adCategories = [
  { name: 'خودرو', slug: 'khodro', icon: 'car', color: '#2563eb' },
  { name: 'املاک', slug: 'amlak', icon: 'building', color: '#16a34a' },
  { name: 'موبایل', slug: 'mobile', icon: 'smartphone', color: '#7c3aed' },
  { name: 'لوازم خانه', slug: 'home-appliances', icon: 'sofa', color: '#ea580c' },
  { name: 'استخدام', slug: 'employment', icon: 'briefcase', color: '#0891b2' },
  { name: 'خدمات', slug: 'services', icon: 'wrench', color: '#ca8a04' },
  { name: 'خرید و فروش', slug: 'buy-sell', icon: 'tag', color: '#db2777' },
  { name: 'سایر', slug: 'other', icon: 'dots', color: '#6b7280' },
];

const businessCategories = [
  { name: 'فروشگاه', slug: 'store', icon: 'shopping-cart', color: '#2563eb' },
  { name: 'رستوران و کافه', slug: 'restaurant', icon: 'utensils', color: '#ea580c' },
  { name: 'خدمات', slug: 'services', icon: 'wrench', color: '#ca8a04' },
  { name: 'بهداشت و درمان', slug: 'health', icon: 'heart-pulse', color: '#dc2626' },
  { name: 'آموزش', slug: 'education', icon: 'graduation-cap', color: '#7c3aed' },
  { name: 'املاک', slug: 'real-estate', icon: 'building', color: '#16a34a' },
  { name: 'خودرو', slug: 'auto', icon: 'car', color: '#0891b2' },
  { name: 'ساختمانی', slug: 'construction', icon: 'hard-hat', color: '#a16207' },
  { name: 'زیبایی و آرایشی', slug: 'beauty', icon: 'sparkles', color: '#db2777' },
  { name: 'فناوری', slug: 'technology', icon: 'cpu', color: '#4f46e5' },
];

const newsCategories = [
  { name: 'عمومی', slug: 'general' },
  { name: 'اجتماعی', slug: 'social' },
  { name: 'اقتصادی', slug: 'economy' },
  { name: 'ورزشی', slug: 'sports' },
  { name: 'فرهنگی', slug: 'culture' },
  { name: 'حوادث', slug: 'incidents' },
];

async function main(): Promise<void> {
  // Provinces
  for (const p of provinces) {
    await prisma.province.upsert({ where: { slug: p.slug }, update: { name: p.name }, create: p });
  }

  // Cities
  for (const c of cities) {
    const province = await prisma.province.findUniqueOrThrow({ where: { slug: c.province } });
    await prisma.city.upsert({
      where: { slug: c.slug },
      update: { name: c.name, latitude: c.latitude, longitude: c.longitude, isFeatured: c.featured },
      create: {
        provinceId: province.id,
        name: c.name,
        slug: c.slug,
        latitude: c.latitude,
        longitude: c.longitude,
        isFeatured: c.featured,
      },
    });
  }

  // Roles
  for (const r of roles) {
    await prisma.role.upsert({ where: { code: r.code }, update: { title: r.title }, create: r });
  }

  // Permissions
  for (const p of permissions) {
    await prisma.permission.upsert({ where: { code: p.code }, update: { title: p.title }, create: p });
  }

  // Role -> Permission links
  for (const [roleCode, permCodes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } } });
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Categories
  for (const c of adCategories) {
    await prisma.adCategory.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }
  for (const c of businessCategories) {
    await prisma.businessCategory.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }
  for (const c of newsCategories) {
    await prisma.newsCategory.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }

  console.log('Seed OK: provinces, cities, roles, permissions, categories');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
