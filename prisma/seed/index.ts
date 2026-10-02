// ShahrJo seed - Phase 1 + Phase 2.
// Idempotent: safe to run multiple times (upsert by slug/code).
// Cities/categories are DATA, never hard-coded in the app; admins can edit later.
// Category set aligns with JamCity UX (docs/jamcity-reference.md) - data only, no code copied.

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
  { province: 'bushehr', name: 'دیر', slug: 'dayer', latitude: 27.84, longitude: 51.94, featured: false },
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
  { code: 'subscriptions.manage', title: 'مدیریت اشتراک‌ها و تایید پرداخت' },
  { code: 'showcase.manage', title: 'مدیریت ویترین طلایی (ترتیب/اولویت)' },
  { code: 'payments.view', title: 'مشاهده پرداخت‌ها' },
  { code: 'news.manage', title: 'مدیریت اخبار' },
  { code: 'chat.moderate', title: 'نظارت بر چت' },
  { code: 'reports.handle', title: 'رسیدگی به گزارش‌ها' },
  { code: 'banners.manage', title: 'مدیریت بنرها' },
  { code: 'map.manage', title: 'مدیریت مکان‌های نقشه' },
  { code: 'roles.manage', title: 'مدیریت نقش‌ها' },
  { code: 'audit.view', title: 'مشاهده لاگ ممیزی' },
];

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map((p) => p.code),
  PROVINCE_ADMIN: [
    'dashboard.view', 'users.view', 'users.manage',
    'ads.view', 'ads.moderate',
    'businesses.view', 'businesses.moderate',
    'subscriptions.manage', 'payments.view', 'showcase.manage',
    'news.manage', 'chat.moderate', 'reports.handle',
    'banners.manage', 'map.manage', 'audit.view',
  ],
  CITY_ADMIN: [
    'dashboard.view', 'users.view',
    'ads.view', 'ads.moderate',
    'businesses.view', 'businesses.moderate',
    'subscriptions.manage', 'payments.view', 'showcase.manage',
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

// 9 ad categories (JamCity-aligned)
const adCategories = [
  { name: 'املاک', slug: 'real-estate', icon: '🏠', color: '#16a34a' },
  { name: 'وسایل نقلیه', slug: 'car', icon: '🚗', color: '#2563eb' },
  { name: 'موبایل', slug: 'mobile', icon: '📱', color: '#7c3aed' },
  { name: 'لوازم خانه', slug: 'home-appliances', icon: '🛋️', color: '#ea580c' },
  { name: 'استخدام', slug: 'jobs', icon: '💼', color: '#0891b2' },
  { name: 'خدمات', slug: 'services', icon: '🛠️', color: '#ca8a04' },
  { name: 'خرید و فروش', slug: 'market', icon: '🛒', color: '#db2777' },
  { name: 'لوازم شخصی', slug: 'personal', icon: '🎒', color: '#9333ea' },
  { name: 'سایر', slug: 'other', icon: '✨', color: '#6b7280' },
];

// 48 business categories (JamCity-aligned: name + emoji, familiar UX)
const businessCategories: { name: string; slug: string; icon: string }[] = [
  { name: 'رستوران', slug: 'restaurant', icon: '🍽️' },
  { name: 'کافه', slug: 'cafe', icon: '☕' },
  { name: 'فست‌فود', slug: 'fastfood', icon: '🍔' },
  { name: 'نانوایی و شیرینی', slug: 'bakery', icon: '🥖' },
  { name: 'سوپرمارکت و مواد غذایی', slug: 'supermarket', icon: '🛒' },
  { name: 'میوه و تره‌بار', slug: 'fruit_store', icon: '🍎' },
  { name: 'پروتئینی و قصابی', slug: 'butcher', icon: '🥩' },
  { name: 'پوشاک', slug: 'clothing', icon: '👕' },
  { name: 'کفش و کیف', slug: 'shoes', icon: '👟' },
  { name: 'لوازم آرایشی و بهداشتی', slug: 'cosmetics', icon: '💄' },
  { name: 'طلا و جواهر', slug: 'jewelry', icon: '💎' },
  { name: 'ساعت و عینک', slug: 'watch_glasses', icon: '⌚' },
  { name: 'موبایل و لوازم جانبی', slug: 'mobile', icon: '📱' },
  { name: 'کامپیوتر و تجهیزات', slug: 'computer', icon: '💻' },
  { name: 'لوازم الکترونیکی', slug: 'electronics', icon: '🔌' },
  { name: 'لوازم خانگی', slug: 'home_appliances', icon: '🏠' },
  { name: 'مبلمان و دکوراسیون', slug: 'furniture', icon: '🛋️' },
  { name: 'اتوگالری و خرید و فروش خودرو', slug: 'car_dealer', icon: '🚗' },
  { name: 'خدمات خودرو', slug: 'car_service', icon: '🔧' },
  { name: 'قطعات و لوازم خودرو', slug: 'car_parts', icon: '⚙️' },
  { name: 'کارواش', slug: 'car_wash', icon: '🚿' },
  { name: 'لاستیک و آپاراتی', slug: 'tire', icon: '🛞' },
  { name: 'خدمات فنی', slug: 'technical', icon: '🧰' },
  { name: 'ساختمان و مصالح', slug: 'construction', icon: '🏗️' },
  { name: 'برق‌کاری', slug: 'electrician', icon: '💡' },
  { name: 'لوله‌کشی و تاسیسات', slug: 'plumbing', icon: '🚰' },
  { name: 'جوشکاری و آهنگاری', slug: 'welding', icon: '🔩' },
  { name: 'پزشکان و درمان', slug: 'doctor', icon: '🩺' },
  { name: 'دندانپزشکی', slug: 'dentist', icon: '🦷' },
  { name: 'داروخانه', slug: 'pharmacy', icon: '💊' },
  { name: 'آزمایشگاه و تشخیص پزشکی', slug: 'laboratory', icon: '🧪' },
  { name: 'آرایشگاه و زیبایی', slug: 'beauty', icon: '💇' },
  { name: 'ورزشی و باشگاه', slug: 'fitness', icon: '🏋️' },
  { name: 'آموزش و کلاس', slug: 'education', icon: '📚' },
  { name: 'مهدکودک و پیش‌دبستانی', slug: 'kindergarten', icon: '🧸' },
  { name: 'املاک', slug: 'real_estate', icon: '🏠' },
  { name: 'گردشگری و اقامت', slug: 'travel', icon: '🏨' },
  { name: 'چاپ و تبلیغات', slug: 'printing', icon: '🖨️' },
  { name: 'عکاسی و فیلم‌برداری', slug: 'photography', icon: '📷' },
  { name: 'گل‌فروشی', slug: 'florist', icon: '🌷' },
  { name: 'پت‌شاپ و خدمات حیوانات', slug: 'pet', icon: '🐾' },
  { name: 'خشکشویی و شست‌وشو', slug: 'laundry', icon: '👔' },
  { name: 'حمل و نقل', slug: 'delivery', icon: '🚚' },
  { name: 'خدمات عمومی', slug: 'services', icon: '🛠️' },
  { name: 'فروشگاه', slug: 'shop', icon: '🛍️' },
  { name: 'تعمیرگاه', slug: 'repair', icon: '🔧' },
  { name: 'سایر', slug: 'other', icon: '✨' },
];

const newsCategories = [
  { name: 'عمومی', slug: 'general' },
  { name: 'اجتماعی', slug: 'social' },
  { name: 'اقتصادی', slug: 'economy' },
  { name: 'ورزشی', slug: 'sports' },
  { name: 'فرهنگی', slug: 'culture' },
  { name: 'حوادث', slug: 'incidents' },
];

// Purchasable plans (Rial). Prices follow the familiar JamCity tiers; admins can edit.
const subscriptionPlans = [
  { code: 'GOLD_1M', tier: 'GOLD' as const, label: '۱ ماهه', badge: null, durationDays: 30, price: 4_000_000, sortOrder: 1 },
  { code: 'GOLD_6M', tier: 'GOLD' as const, label: '۶ ماهه', badge: 'پیشنهاد ویژه', durationDays: 180, price: 15_000_000, sortOrder: 2 },
  { code: 'GOLD_12M', tier: 'GOLD' as const, label: '۱۲ ماهه', badge: 'به‌صرفه‌ترین', durationDays: 365, price: 25_000_000, sortOrder: 3 },
  { code: 'SILVER_1M', tier: 'SILVER' as const, label: '۱ ماهه', badge: null, durationDays: 30, price: 2_000_000, sortOrder: 4 },
  { code: 'SILVER_6M', tier: 'SILVER' as const, label: '۶ ماهه', badge: 'پیشنهاد ویژه', durationDays: 180, price: 8_000_000, sortOrder: 5 },
  { code: 'SILVER_12M', tier: 'SILVER' as const, label: '۱۲ ماهه', badge: 'به‌صرفه‌ترین', durationDays: 365, price: 13_000_000, sortOrder: 6 },
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

  // Ad categories (target list wins; remove rows left over from older seeds)
  for (const c of adCategories) {
    const { color, ...data } = c;
    await prisma.adCategory.upsert({ where: { slug: c.slug }, update: { name: c.name, icon: c.icon, color }, create: { ...data, color } });
  }
  await prisma.adCategory.deleteMany({ where: { slug: { notIn: adCategories.map((c) => c.slug) } } });

  // Business categories (48, JamCity-aligned)
  for (const c of businessCategories) {
    await prisma.businessCategory.upsert({ where: { slug: c.slug }, update: { name: c.name, icon: c.icon }, create: c });
  }
  await prisma.businessCategory.deleteMany({ where: { slug: { notIn: businessCategories.map((c) => c.slug) } } });

  // News categories
  for (const c of newsCategories) {
    await prisma.newsCategory.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }

  // Subscription plans (Gold / Silver)
  for (const p of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: { label: p.label, badge: p.badge, durationDays: p.durationDays, price: p.price, sortOrder: p.sortOrder, tier: p.tier },
      create: p,
    });
  }

  console.log(
    `Seed OK: ${provinces.length} provinces, ${cities.length} cities, ${roles.length} roles, ` +
      `${permissions.length} permissions, ${adCategories.length} ad categories, ` +
      `${businessCategories.length} business categories, ${subscriptionPlans.length} plans`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
