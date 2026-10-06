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
  { code: 'storage.manage', title: 'مدیریت فضای ذخیره‌سازی و پاک‌سازی' },
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

// Business categories (JamCity-aligned: name + emoji, familiar UX).
// Deliberately broad: every trade a real city has, so owners always find
// their own line of business when registering.
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
  // ---- expansion: cover every trade a city actually has ----
  // food & drink
  { name: 'سفره خانه', slug: 'traditional_eatery', icon: '🍲' },
  { name: 'ساندویچی', slug: 'sandwich_shop', icon: '🥪' },
  { name: 'پیتزا', slug: 'pizzeria', icon: '🍕' },
  { name: 'کبابی', slug: 'kabab_house', icon: '🍢' },
  { name: 'رستوران دریایی', slug: 'seafood_restaurant', icon: '🦐' },
  { name: 'رستوران گیاهی', slug: 'vegetarian_restaurant', icon: '🥦' },
  { name: 'قنادی و شیرینی', slug: 'confectionery', icon: '🍰' },
  { name: 'نان بربری و تنوری', slug: 'traditional_bread', icon: '🫓' },
  { name: 'آبمیوه و بستنی', slug: 'juice_bar', icon: '🥤' },
  { name: 'قهوه‌خانه', slug: 'coffeehouse', icon: '🫖' },
  { name: 'چایخانه', slug: 'teahouse', icon: '🍵' },
  { name: 'کیترینگ و مجالس', slug: 'catering', icon: '🍽️' },
  // food retail
  { name: 'لبنیاتی', slug: 'dairy_shop', icon: '🥛' },
  { name: 'سبزی فروشی', slug: 'greengrocer', icon: '🥬' },
  { name: 'خواروبار', slug: 'grocery_store', icon: '🥡' },
  { name: 'عطاری', slug: 'herbalist', icon: '🌿' },
  { name: 'عسل و محصولات طبیعی', slug: 'honey_shop', icon: '🍯' },
  { name: 'محصولات ارگانیک', slug: 'organic_store', icon: '🥗' },
  { name: 'مرغ و تخم‌مرغ', slug: 'poultry_shop', icon: '🐔' },
  // education & training
  { name: 'آموزشگاه زبان', slug: 'language_school', icon: '🗣️' },
  { name: 'آموزشگاه موسیقی', slug: 'music_school', icon: '🎵' },
  { name: 'آموزشگاه هنری', slug: 'art_school', icon: '🎨' },
  { name: 'کلاس کنکور و تقویتی', slug: 'tutoring_center', icon: '🎓' },
  { name: 'مرکز فنی و حرفه‌ای', slug: 'vocational_training', icon: '🧑‍🏫' },
  { name: 'آموزشگاه رانندگی', slug: 'driving_school', icon: '🚦' },
  // retail & shops
  { name: 'لوازم‌التحریر', slug: 'stationery_shop', icon: '✏️' },
  { name: 'کتاب‌فروشی', slug: 'bookstore', icon: '📖' },
  { name: 'اسباب‌بازی', slug: 'toy_store', icon: '🧸' },
  { name: 'لباس بچه و نوزاد', slug: 'baby_store', icon: '👶' },
  { name: 'مادر و کودک', slug: 'maternity_store', icon: '🍼' },
  { name: 'خیاطی', slug: 'tailor', icon: '🧵' },
  { name: 'عطر و ادکلن', slug: 'perfume_shop', icon: '🌸' },
  { name: 'اثاثیه دست‌دوم', slug: 'second_hand_store', icon: '♻️' },
  // beauty & personal
  { name: 'آرایشگاه مردانه', slug: 'barber_shop', icon: '💈' },
  { name: 'اسپا و اپیلاسیون', slug: 'spa_salon', icon: '🧖' },
  { name: 'میکاپ و ناخن', slug: 'nail_and_makeup', icon: '💅' },
  { name: 'عینک‌فروشی', slug: 'eyeglass_shop', icon: '🕶️' },
  // tech & services
  { name: 'تعمیر موبایل', slug: 'phone_repair', icon: '🛠️' },
  { name: 'شارژ و لوازم جانبی موبایل', slug: 'mobile_accessories', icon: '📶' },
  { name: 'دوربین و تجهیزات حفاظتی', slug: 'security_camera', icon: '📹' },
  { name: 'اینترنت و شبکه', slug: 'internet_services', icon: '🌐' },
  { name: 'نمایندگی اپراتور موبایل', slug: 'telecom_agent', icon: '📡' },
  // finance & legal
  { name: 'صرافی', slug: 'currency_exchange', icon: '💱' },
  { name: 'بیمه', slug: 'insurance_office', icon: '🛡️' },
  { name: 'دفتر خدمات قضایی', slug: 'legal_services', icon: '⚖️' },
  { name: 'وکالت', slug: 'law_office', icon: '👨‍⚖️' },
  { name: 'دفاتر پیشخوان', slug: 'service_office', icon: '🏛️' },
  // health
  { name: 'کلینیک و مطب', slug: 'medical_clinic', icon: '🏥' },
  { name: 'فیزیوتراپی', slug: 'physiotherapy', icon: '💆' },
  { name: 'دامپزشکی', slug: 'veterinary_clinic', icon: '🐕' },
  { name: 'مراقبت و پرستاری در منزل', slug: 'home_care', icon: '🤱' },
  // sport & leisure
  { name: 'استخر و مجموعه آبی', slug: 'swimming_pool', icon: '🏊' },
  { name: 'لوازم ورزشی', slug: 'sports_store', icon: '🏅' },
  { name: 'دوچرخه‌فروشی', slug: 'bicycle_shop', icon: '🚲' },
  { name: 'باشگاه بیلیارد', slug: 'billiard_hall', icon: '🎱' },
  { name: 'گیم‌نت', slug: 'gaming_cafe', icon: '🎮' },
  // construction & home
  { name: 'ابزار فروشی', slug: 'hardware_tools', icon: '🪚' },
  { name: 'آهن و فلزات', slug: 'metals_trade', icon: '🏭' },
  { name: 'رنگ و ابزار نقاشی', slug: 'paint_shop', icon: '🖌️' },
  { name: 'درب و پنجره', slug: 'doors_windows', icon: '🚪' },
  { name: 'کابینت و ام‌دی‌اف', slug: 'cabinet_shop', icon: '🪵' },
  { name: 'قالی و موکت', slug: 'carpet_shop', icon: '🧶' },
  { name: 'کفپوش و پارکت', slug: 'flooring_shop', icon: '🟫' },
  { name: 'کاغذ دیواری', slug: 'wallpaper_shop', icon: '🖼️' },
  { name: 'بنایی و بازسازی', slug: 'masonry', icon: '🧱' },
  { name: 'پیمانکاری ساختمان', slug: 'construction_contractor', icon: '🏗️' },
  { name: 'نقشه‌برداری و مهندسی', slug: 'survey_office', icon: '📐' },
  { name: 'شیشه و آینه', slug: 'glass_shop', icon: '🪞' },
  { name: 'تابلوسازی', slug: 'sign_making', icon: '🪧' },
  { name: 'کلید و پریز و لوازم برقی', slug: 'electrical_shop', icon: '⚡' },
  { name: 'نصب و سرویس کولر', slug: 'ac_service', icon: '❄️' },
  { name: 'سرویس پکیج و شوفاژ', slug: 'heating_service', icon: '🌡️' },
  { name: 'تعمیر لوازم خانگی', slug: 'appliance_repair', icon: '🧯' },
  { name: 'نمایندگی لوازم خانگی', slug: 'appliance_dealer', icon: '🏪' },
  { name: 'مبل‌شویی و رویه‌کوبی', slug: 'upholstery_service', icon: '🧽' },
  { name: 'تعمیر اثاثیه', slug: 'furniture_repair', icon: '🔨' },
  { name: 'نظافت منزل و محل کار', slug: 'cleaning_service', icon: '🧼' },
  { name: 'سمپاشی و مبارزه با آفات', slug: 'pest_control', icon: '🐜' },
  // transport
  { name: 'باربری و اتوبار', slug: 'moving_company', icon: '📦' },
  { name: 'پیک و پیک‌موتوری', slug: 'courier_service', icon: '🛵' },
  { name: 'تاکسی و سرویس مدرسه', slug: 'taxi_service', icon: '🚕' },
  { name: 'پمپ بنزین و گاز', slug: 'gas_station', icon: '⛽' },
  { name: 'صافکاری و رنگ خودرو', slug: 'auto_body_shop', icon: '🚘' },
  { name: 'تعویض روغن و فیلتر', slug: 'oil_change_service', icon: '🛢️' },
  { name: 'نمایندگی خودرو', slug: 'car_agency', icon: '🏁' },
  // creative & agency
  { name: 'طراحی گرافیک', slug: 'graphic_design', icon: '🖥️' },
  { name: 'فیلم‌برداری و آتلیه عروسی', slug: 'wedding_video', icon: '🎥' },
  { name: 'ترجمه زبان', slug: 'translation_office', icon: '🔤' },
  // agri
  { name: 'گلخانه و فروش نهال', slug: 'plant_nursery', icon: '🌱' },
  { name: 'لوازم کشاورزی', slug: 'farm_supply', icon: '🚜' },
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

// Admin panel operator (Phase 8). A phone number is data, never code —
// the row only grants the SUPER_ADMIN role; login still requires SMS OTP.
const ADMIN_PHONE = '09174057031';

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

  // Business categories (JamCity-aligned + full local-trade coverage)
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

  // Admin operator: user row + admin_users binding (idempotent).
  const adminUser = await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: {},
    create: { phone: ADMIN_PHONE },
  });
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  await prisma.adminUser.upsert({
    where: { userId: adminUser.id },
    update: { roleId: superAdminRole.id, isActive: true },
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  console.log(
    `Seed OK: ${provinces.length} provinces, ${cities.length} cities, ${roles.length} roles, ` +
      `${permissions.length} permissions, ${adCategories.length} ad categories, ` +
      `${businessCategories.length} business categories, ${subscriptionPlans.length} plans, admin ${ADMIN_PHONE}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
