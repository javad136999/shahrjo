// ShahrJo seed - Phase 1 + Phase 2.
// Idempotent: safe to run multiple times (upsert by slug/code).
// Cities/categories are DATA, never hard-coded in the app; admins can edit later.
// Category set aligns with JamCity UX (docs/jamcity-reference.md) - data only, no code copied.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const provinces = [
  { name: 'بوشهر', slug: 'bushehr' },
  { name: 'فارس', slug: 'fars' },
  { name: 'اصفهان', slug: 'isfahan' },
  { name: 'یزد', slug: 'yazd' },
  { name: 'کرمان', slug: 'kerman' },
  { name: 'خوزستان', slug: 'khuzestan' },
  { name: 'تهران', slug: 'tehran' },
  { name: 'خراسان رضوی', slug: 'khorasan-razavi' },
  { name: 'خراسان شمالی', slug: 'khorasan-shomali' },
  { name: 'خراسان جنوبی', slug: 'khorasan-jonoubi' },
  { name: 'آذربایجان شرقی', slug: 'east-azerbaijan' },
  { name: 'آذربایجان غربی', slug: 'west-azerbaijan' },
  { name: 'کردستان', slug: 'kurdistan' },
  { name: 'چهارمحال و بختیاری', slug: 'chaharmahal-bakhtiari' },
  { name: 'کهگیلویه و بویراحمد', slug: 'kohgiluyeh-boyer-ahmad' },
  { name: 'سمنان', slug: 'semnan' },
  { name: 'گیلان', slug: 'gilan' },
  { name: 'مازندران', slug: 'mazandaran' },
];

const cities = [
  { province: 'bushehr', name: 'جم', slug: 'jam', latitude: 27.83, longitude: 52.32, featured: true, boundary: [[[52.2945534, 27.7750899], [52.2945534, 27.842128], [52.3825848, 27.842128], [52.3825848, 27.7750899], [52.2945534, 27.7750899]]] },
  { province: 'bushehr', name: 'عسلویه', slug: 'asaluyeh', latitude: 27.48, longitude: 52.6, featured: true, boundary: [[[52.5843733, 27.4642088], [52.5843733, 27.4937237], [52.6277437, 27.4937237], [52.6277437, 27.4642088], [52.5843733, 27.4642088]]] },
  { province: 'bushehr', name: 'کنگان', slug: 'kangan', latitude: 27.8368, longitude: 52.0657, featured: false, boundary: [[[52.0339702, 27.8030094], [52.0339702, 27.8706114], [52.0973476, 27.8706114], [52.0973476, 27.8030094], [52.0339702, 27.8030094]]] },
  { province: 'bushehr', name: 'گناوه', slug: 'ganaveh', latitude: 29.5808, longitude: 50.5172, featured: false, boundary: [[[50.4676, 29.5446], [50.4676, 29.617], [50.5668, 29.617], [50.5668, 29.5446], [50.4676, 29.5446]]] },
  { province: 'bushehr', name: 'برازجان', slug: 'borazjan', latitude: 29.2694, longitude: 51.22, featured: false, boundary: [[[51.1745, 29.232], [51.1745, 29.307], [51.2655, 29.307], [51.2655, 29.232], [51.1745, 29.232]]] },
  { province: 'bushehr', name: 'دیر', slug: 'dayer', latitude: 27.84, longitude: 51.94, featured: false },
  { province: 'bushehr', name: 'بوشهر', slug: 'bushehr-city', latitude: 28.97, longitude: 50.84, featured: true, boundary: [[[50.802536, 28.8539379], [50.802536, 29.0045185], [50.9044647, 29.0045185], [50.9044647, 28.8539379], [50.802536, 28.8539379]]] },
  { province: 'fars', name: 'شیراز', slug: 'shiraz', latitude: 29.59, longitude: 52.58, featured: true, boundary: [[[52.3822546, 29.4987382], [52.3822546, 29.8403461], [52.6675129, 29.8403461], [52.6675129, 29.4987382], [52.3822546, 29.4987382]]] },
  { province: 'fars', name: 'جهرم', slug: 'jahrom', latitude: 28.5, longitude: 53.56, featured: false, boundary: [[[53.5266763, 28.4675892], [53.5266763, 28.5630963], [53.6485027, 28.5630963], [53.6485027, 28.4675892], [53.5266763, 28.4675892]]] },
  { province: 'fars', name: 'لار', slug: 'lar', latitude: 27.69, longitude: 54.3, featured: false, boundary: [[[54.2748937, 27.6259389], [54.2748937, 27.697492], [54.3679046, 27.697492], [54.3679046, 27.6259389], [54.2748937, 27.6259389]]] },
  { province: 'fars', name: 'آباده', slug: 'abadeh', latitude: 31.1627, longitude: 52.649, featured: false, boundary: [[[52.5999551, 31.1315691], [52.5999551, 31.2161316], [52.7046522, 31.2161316], [52.7046522, 31.1315691], [52.5999551, 31.1315691]]] },
  { province: 'fars', name: 'اقلید', slug: 'eghlid', latitude: 30.8926, longitude: 52.6885, featured: false, boundary: [[[52.637185, 30.8370564], [52.637185, 30.9405076], [52.7431217, 30.9405076], [52.7431217, 30.8370564], [52.637185, 30.8370564]]] },
  { province: 'fars', name: 'صفاشهر', slug: 'safashahr', latitude: 30.6114, longitude: 53.1913, featured: false, boundary: [[[53.1053291, 30.5654504], [53.1053291, 30.6325877], [53.2225953, 30.6325877], [53.2225953, 30.5654504], [53.1053291, 30.5654504]]] },
  { province: 'fars', name: 'مرودشت', slug: 'marvdasht', latitude: 29.8763, longitude: 52.8063, featured: false, boundary: [[[52.7788576, 29.8489797], [52.7788576, 29.9021739], [52.8348901, 29.9021739], [52.8348901, 29.8489797], [52.7788576, 29.8489797]]] },
  { province: 'fars', name: 'سپیدان', slug: 'sepidan', latitude: 30.2624, longitude: 51.9837, featured: false, boundary: [[[51.9768823, 30.2504693], [51.9768823, 30.2700376], [51.9914075, 30.2700376], [51.9914075, 30.2504693], [51.9768823, 30.2504693]]] },
  { province: 'fars', name: 'کازرون', slug: 'kazerun', latitude: 29.6203, longitude: 51.6521, featured: false, boundary: [[[51.6129551, 29.5926109], [51.6129551, 29.6415886], [51.694292, 29.6415886], [51.694292, 29.5926109], [51.6129551, 29.5926109]]] },
  { province: 'fars', name: 'فسا', slug: 'fasa', latitude: 28.9366, longitude: 53.6511, featured: false, boundary: [[[53.587253, 28.9177436], [53.587253, 28.9867452], [53.6696769, 28.9867452], [53.6696769, 28.9177436], [53.587253, 28.9177436]]] },
  { province: 'fars', name: 'نیریز', slug: 'neyriz', latitude: 29.1973, longitude: 54.3268, featured: false, boundary: [[[54.284563, 29.1706744], [54.284563, 29.2154068], [54.3600511, 29.2154068], [54.3600511, 29.1706744], [54.284563, 29.1706744]]] },
  // Sadra and major provincial population centres; population ranking uses the 2016 census.
  { province: 'fars', name: 'صدرا', slug: 'sadra', latitude: 29.8153909, longitude: 52.4748633, featured: false },
  { province: 'isfahan', name: 'اصفهان', slug: 'isfahan', latitude: 32.670788, longitude: 51.665, featured: true },
  { province: 'isfahan', name: 'کاشان', slug: 'kashan', latitude: 33.987653, longitude: 51.442886, featured: false },
  { province: 'isfahan', name: 'خمینی‌شهر', slug: 'khomeyni-shahr', latitude: 32.69382, longitude: 51.525489, featured: false },
  { province: 'isfahan', name: 'نجف‌آباد', slug: 'najaf-abad', latitude: 32.635074, longitude: 51.36368, featured: false },
  { province: 'isfahan', name: 'شاهین‌شهر', slug: 'shahin-shahr', latitude: 32.855617, longitude: 51.558376, featured: false },
  { province: 'yazd', name: 'یزد', slug: 'yazd', latitude: 31.89722, longitude: 54.3675, featured: true },
  { province: 'yazd', name: 'میبد', slug: 'meybod', latitude: 32.27208, longitude: 54.02776, featured: false },
  { province: 'yazd', name: 'اردکان', slug: 'ardakan', latitude: 32.31001, longitude: 54.01747, featured: false },
  { province: 'yazd', name: 'حمیدیا', slug: 'hamidiya', latitude: 31.82248, longitude: 54.39284, featured: false },
  { province: 'yazd', name: 'بافق', slug: 'bafq', latitude: 31.6035, longitude: 55.40249, featured: false },
  { province: 'kerman', name: 'کرمان', slug: 'kerman', latitude: 30.28321, longitude: 57.07879, featured: true },
  { province: 'kerman', name: 'سیرجان', slug: 'sirjan', latitude: 29.45137, longitude: 55.6809, featured: false },
  { province: 'kerman', name: 'رفسنجان', slug: 'rafsanjan', latitude: 30.4067, longitude: 55.9939, featured: false },
  { province: 'kerman', name: 'جیرفت', slug: 'jiroft', latitude: 28.67806, longitude: 57.74056, featured: false },
  { province: 'kerman', name: 'بم', slug: 'bam', latitude: 29.106, longitude: 58.357, featured: false },
  { province: 'khuzestan', name: 'اهواز', slug: 'ahvaz', latitude: 31.31901, longitude: 48.6842, featured: true },
  { province: 'khuzestan', name: 'دزفول', slug: 'dezful', latitude: 32.38114, longitude: 48.40581, featured: false },
  { province: 'khuzestan', name: 'آبادان', slug: 'abadan', latitude: 30.3392, longitude: 48.3043, featured: false },
  { province: 'khuzestan', name: 'بندر ماهشهر', slug: 'bandar-mahshahr', latitude: 30.55655, longitude: 49.18852, featured: false },
  { province: 'khuzestan', name: 'اندیمشک', slug: 'andimeshk', latitude: 32.4615, longitude: 48.35368, featured: false },
  { province: 'tehran', name: 'تهران', slug: 'tehran', latitude: 35.6892523, longitude: 51.3896004, featured: true },
  { province: 'tehran', name: 'اسلام‌شهر', slug: 'eslamshahr', latitude: 35.5478513, longitude: 51.2318676, featured: false },
  { province: 'tehran', name: 'شهریار', slug: 'shahriar', latitude: 35.6589015, longitude: 51.0586022, featured: false },
  { province: 'tehran', name: 'قدس', slug: 'qods', latitude: 35.7204271, longitude: 51.1100769, featured: false },
  { province: 'tehran', name: 'ملارد', slug: 'malard', latitude: 35.666763, longitude: 50.9790423, featured: false },
  // Major cities in seven additional provinces; ranking uses 2016 city census data.
  { province: 'khorasan-razavi', name: 'مشهد', slug: 'mashhad', latitude: 36.2974945, longitude: 59.6059232, featured: true },
  { province: 'khorasan-razavi', name: 'نیشابور', slug: 'neyshabur', latitude: 36.2105604, longitude: 58.7922291, featured: false },
  { province: 'khorasan-razavi', name: 'سبزوار', slug: 'sabzevar', latitude: 36.2134053, longitude: 57.6808799, featured: false },
  { province: 'khorasan-razavi', name: 'تربت حیدریه', slug: 'torbat-heydariyeh', latitude: 35.2740853, longitude: 59.2194494, featured: false },
  { province: 'khorasan-razavi', name: 'کاشمر', slug: 'kashmar', latitude: 35.2446715, longitude: 58.4641341, featured: false },
  { province: 'khorasan-shomali', name: 'بجنورد', slug: 'bojnurd', latitude: 37.4759752, longitude: 57.3319881, featured: true },
  { province: 'khorasan-shomali', name: 'شیروان', slug: 'shirvan', latitude: 37.3964405, longitude: 57.9303523, featured: false },
  { province: 'khorasan-shomali', name: 'اسفراین', slug: 'esfarayen', latitude: 37.0750975, longitude: 57.5096169, featured: false },
  { province: 'khorasan-shomali', name: 'آشخانه', slug: 'ashkhaneh', latitude: 37.5603754, longitude: 56.922995, featured: false },
  { province: 'khorasan-shomali', name: 'جاجرم', slug: 'jajarm', latitude: 36.9499996, longitude: 56.3792939, featured: false },
  { province: 'khorasan-jonoubi', name: 'بیرجند', slug: 'birjand', latitude: 32.8657752, longitude: 59.2214201, featured: true },
  { province: 'khorasan-jonoubi', name: 'قائن', slug: 'qaen', latitude: 33.7339874, longitude: 59.1793303, featured: false },
  { province: 'khorasan-jonoubi', name: 'طبس', slug: 'tabas', latitude: 33.5962283, longitude: 56.9249087, featured: false },
  { province: 'khorasan-jonoubi', name: 'فردوس', slug: 'ferdows', latitude: 34.0187655, longitude: 58.1717681, featured: false },
  { province: 'khorasan-jonoubi', name: 'نهبندان', slug: 'nehbandan', latitude: 31.5431543, longitude: 60.0349456, featured: false },
  { province: 'east-azerbaijan', name: 'تبریز', slug: 'tabriz', latitude: 38.0738612, longitude: 46.2978789, featured: true },
  { province: 'east-azerbaijan', name: 'مراغه', slug: 'maragheh', latitude: 37.3913128, longitude: 46.2435751, featured: false },
  { province: 'east-azerbaijan', name: 'مرند', slug: 'marand', latitude: 38.4306358, longitude: 45.7741, featured: false },
  { province: 'east-azerbaijan', name: 'اهر', slug: 'ahar', latitude: 38.4774934, longitude: 47.0662215, featured: false },
  { province: 'east-azerbaijan', name: 'میانه', slug: 'mianeh', latitude: 37.4284148, longitude: 47.7058119, featured: false },
  { province: 'west-azerbaijan', name: 'ارومیه', slug: 'urmia', latitude: 37.548341, longitude: 45.0667111, featured: true },
  { province: 'west-azerbaijan', name: 'خوی', slug: 'khoy', latitude: 38.5479104, longitude: 44.9512397, featured: false },
  { province: 'west-azerbaijan', name: 'بوکان', slug: 'bukan', latitude: 36.5215096, longitude: 46.2111837, featured: false },
  { province: 'west-azerbaijan', name: 'مهاباد', slug: 'mahabad', latitude: 36.7651739, longitude: 45.7218136, featured: false },
  { province: 'west-azerbaijan', name: 'میاندوآب', slug: 'miandoab', latitude: 36.9695588, longitude: 46.0993809, featured: false },
  { province: 'kurdistan', name: 'سنندج', slug: 'sanandaj', latitude: 35.31495, longitude: 46.99883, featured: true },
  { province: 'kurdistan', name: 'سقز', slug: 'saqqez', latitude: 36.24992, longitude: 46.2735, featured: false },
  { province: 'kurdistan', name: 'مریوان', slug: 'marivan', latitude: 35.51829, longitude: 46.18298, featured: false },
  { province: 'kurdistan', name: 'بانه', slug: 'baneh', latitude: 35.9975, longitude: 45.8853, featured: false },
  { province: 'kurdistan', name: 'قروه', slug: 'qorveh', latitude: 35.1664, longitude: 47.80564, featured: false },
  { province: 'chaharmahal-bakhtiari', name: 'شهرکرد', slug: 'shahrekord', latitude: 32.3257366, longitude: 50.8497369, featured: true },
  { province: 'chaharmahal-bakhtiari', name: 'بروجن', slug: 'borujen', latitude: 31.9719093, longitude: 51.291596, featured: false },
  { province: 'chaharmahal-bakhtiari', name: 'لردگان', slug: 'lordegan', latitude: 31.5135384, longitude: 50.8300461, featured: false },
  { province: 'chaharmahal-bakhtiari', name: 'فرخ‌شهر', slug: 'farokh-shahr', latitude: 32.2732354, longitude: 50.9836849, featured: false },
  { province: 'chaharmahal-bakhtiari', name: 'فارسان', slug: 'farsan', latitude: 32.2569444, longitude: 50.5608333, featured: false },
  { province: 'kohgiluyeh-boyer-ahmad', name: 'یاسوج', slug: 'yasuj', latitude: 30.66824, longitude: 51.58796, featured: true },
  { province: 'kohgiluyeh-boyer-ahmad', name: 'دوگنبدان', slug: 'dogonbadan', latitude: 30.3586, longitude: 50.7981, featured: false },
  { province: 'kohgiluyeh-boyer-ahmad', name: 'دهدشت', slug: 'dehdasht', latitude: 30.79337, longitude: 50.56508, featured: false },
  { province: 'kohgiluyeh-boyer-ahmad', name: 'لیکک', slug: 'likak', latitude: 30.8949, longitude: 50.0931, featured: false },
  { province: 'kohgiluyeh-boyer-ahmad', name: 'مادوان', slug: 'madavan', latitude: 30.71525, longitude: 51.54131, featured: false },
  { province: 'semnan', name: 'سمنان', slug: 'semnan', latitude: 35.5773718, longitude: 53.3950637, featured: true },
  { province: 'semnan', name: 'شاهرود', slug: 'shahroud', latitude: 36.4195026, longitude: 54.9649915, featured: false },
  { province: 'semnan', name: 'دامغان', slug: 'damghan', latitude: 36.167451, longitude: 54.3379993, featured: false },
  { province: 'semnan', name: 'گرمسار', slug: 'garmsar', latitude: 35.2221321, longitude: 52.3385276, featured: false },
  { province: 'semnan', name: 'مهدی‌شهر', slug: 'mehdishahr', latitude: 35.7108029, longitude: 53.3555769, featured: false },
  // Gilan's ten largest cities by the 2016 census; null boundaries use a map window around each center.
  { province: 'gilan', name: 'رشت', slug: 'rasht', latitude: 37.2697578, longitude: 49.5894854, featured: true },
  { province: 'gilan', name: 'بندر انزلی', slug: 'bandar-anzali', latitude: 37.4716356, longitude: 49.4685904, featured: false },
  { province: 'gilan', name: 'لاهیجان', slug: 'lahijan', latitude: 37.2060727, longitude: 50.0028774, featured: false },
  { province: 'gilan', name: 'لنگرود', slug: 'langarud', latitude: 37.1955948, longitude: 50.1529566, featured: false },
  { province: 'gilan', name: 'تالش', slug: 'talesh', latitude: 37.7974981, longitude: 48.904184, featured: false },
  { province: 'gilan', name: 'آستارا', slug: 'astara', latitude: 38.4193239, longitude: 48.8715278, featured: false },
  { province: 'gilan', name: 'صومعه‌سرا', slug: 'someh-sara', latitude: 37.301672, longitude: 49.3147378, featured: false },
  { province: 'gilan', name: 'آستانه اشرفیه', slug: 'astaneh-ashrafiyeh', latitude: 37.2607374, longitude: 49.9456642, featured: false },
  { province: 'gilan', name: 'رودسر', slug: 'rudsar', latitude: 37.1381592, longitude: 50.2927862, featured: false },
  { province: 'gilan', name: 'فومن', slug: 'fuman', latitude: 37.2273234, longitude: 49.3141954, featured: false },
  // Mazandaran's ten largest cities by the 2016 city census; coordinates are approximate city centres.
  { province: 'mazandaran', name: 'ساری', slug: 'sari', latitude: 36.5633, longitude: 53.0601, featured: true },
  { province: 'mazandaran', name: 'بابل', slug: 'babol', latitude: 36.5387, longitude: 52.6789, featured: false },
  { province: 'mazandaran', name: 'آمل', slug: 'amol', latitude: 36.4696, longitude: 52.3507, featured: false },
  { province: 'mazandaran', name: 'قائم‌شهر', slug: 'qaem-shahr', latitude: 36.4636, longitude: 52.8618, featured: false },
  { province: 'mazandaran', name: 'بهشهر', slug: 'behshahr', latitude: 36.6923, longitude: 53.5526, featured: false },
  { province: 'mazandaran', name: 'چالوس', slug: 'chalus', latitude: 36.6550, longitude: 51.4204, featured: false },
  { province: 'mazandaran', name: 'نکا', slug: 'neka', latitude: 36.6500, longitude: 53.2990, featured: false },
  { province: 'mazandaran', name: 'بابلسر', slug: 'babolsar', latitude: 36.7002, longitude: 52.6501, featured: false },
  { province: 'mazandaran', name: 'تنکابن', slug: 'tonekabon', latitude: 36.8167, longitude: 50.8736, featured: false },
  { province: 'mazandaran', name: 'نوشهر', slug: 'nowshahr', latitude: 36.6488, longitude: 51.4960, featured: false },
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

// Service-desk trades (دفتر خدمات شهر): the «شغلتو ثبت کن» / «چه خدماتی نیاز داری»
// tiles on the city home page. Deliberately service-only — shops, restaurants
// and venues are NOT in here, they stay in `businessCategories` for the full
// /business/new signup. Slugs are prefixed so they can never collide with (or
// overwrite) a general category, and the list ends with a «سایر» catch-all.
const serviceCategories: { name: string; slug: string; icon: string }[] = [
  { name: 'تعمیرکار کولر', slug: 'svc_ac_repair', icon: '❄️' },
  { name: 'نقاش ساختمان', slug: 'svc_house_painter', icon: '🎨' },
  { name: 'برقکار ساختمان', slug: 'svc_electrician', icon: '💡' },
  { name: 'تعمیر یخچال', slug: 'svc_fridge_repair', icon: '🧊' },
  { name: 'لوله‌کش و تعمیرات تاسیسات', slug: 'svc_plumber', icon: '🚰' },
  { name: 'کابینت‌ساز', slug: 'svc_cabinet_maker', icon: '🪚' },
  { name: 'بنایی و بازسازی', slug: 'svc_mason', icon: '🧱' },
  { name: 'نقاش و گچ‌کار', slug: 'svc_plasterer', icon: '🧰' },
  { name: 'کاشی‌کار و سرامیک‌کار', slug: 'svc_tiler', icon: '🟫' },
  { name: 'جوشکار و آهنگر', slug: 'svc_welder', icon: '🔩' },
  { name: 'تعمیر ماشین لباسشویی', slug: 'svc_washer_repair', icon: '🌀' },
  { name: 'تعمیر ظرفشویی و اجاق‌گاز', slug: 'svc_stove_repair', icon: '🍳' },
  { name: 'سرویس پکیج و شوفاژ', slug: 'svc_heating_repair', icon: '🌡️' },
  { name: 'تعمیر تلویزیون', slug: 'svc_tv_repair', icon: '📺' },
  { name: 'تعمیر موبایل', slug: 'svc_phone_repair', icon: '📱' },
  { name: 'تعمیر لپ‌تاپ و کامپیوتر', slug: 'svc_pc_repair', icon: '💻' },
  { name: 'سرویس آسانسور', slug: 'svc_elevator_service', icon: '🛗' },
  { name: 'نظافت منزل و محل کار', slug: 'svc_cleaner', icon: '🧼' },
  { name: 'باربری و اتوبار', slug: 'svc_mover', icon: '📦' },
  { name: 'سمپاشی و مبارزه با آفات', slug: 'svc_pest_control', icon: '🐜' },
  { name: 'باغبانی و فضای سبز', slug: 'svc_gardener', icon: '🌿' },
  { name: 'کارواش سیار', slug: 'svc_car_wash', icon: '🚿' },
  { name: 'آپاراتی و تعویض لاستیک', slug: 'svc_tire_repair', icon: '🛞' },
  { name: 'تعمیر موتورسیکلت', slug: 'svc_motorcycle_repair', icon: '🏍️' },
  { name: 'صافکاری و رنگ خودرو', slug: 'svc_auto_body', icon: '🚘' },
  { name: 'خیاط و تعمیر لباس', slug: 'svc_tailor', icon: '🧵' },
  { name: 'آرایشگر سیار', slug: 'svc_barber', icon: '💈' },
  { name: 'تعمیر کیف و کفش', slug: 'svc_shoe_repair', icon: '👞' },
  { name: 'تعمیر ساعت', slug: 'svc_watch_repair', icon: '⌚' },
  { name: 'پرستار کودک', slug: 'svc_babysitter', icon: '🧸' },
  { name: 'پرستار سالمند', slug: 'svc_elder_care', icon: '🧓' },
  { name: 'معلم خصوصی', slug: 'svc_private_tutor', icon: '📚' },
  { name: 'عکاس و فیلم‌بردار', slug: 'svc_photographer', icon: '📷' },
  { name: 'تابلوساز', slug: 'svc_sign_maker', icon: '🪧' },
  { name: 'مترجم', slug: 'svc_translator', icon: '🔤' },
  { name: 'سایر خدمات', slug: 'svc_other', icon: '✨' },
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
      update: { name: c.name, latitude: c.latitude, longitude: c.longitude, isFeatured: c.featured, ...(c.boundary ? { boundary: c.boundary } : {}) },
      create: {
        provinceId: province.id,
        name: c.name,
        slug: c.slug,
        latitude: c.latitude,
        longitude: c.longitude,
        isFeatured: c.featured,
        ...(c.boundary ? { boundary: c.boundary } : {}),
      },
    });
  }

  // Wall group member floor: one fixed random 1..1000 per city — assigned
  // once and never rerolled. The wall header shows this floor + the real
  // site members of that city (each new user adds up automatically).
  const baseless = await prisma.city.findMany({ where: { wallMemberBase: null }, select: { id: true } });
  for (const city of baseless) {
    await prisma.city.update({
      where: { id: city.id },
      data: { wallMemberBase: Math.floor(Math.random() * 1000) + 1 },
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
  // Keep legacy categories that still classify live businesses; removing them
  // violates the category FK and would orphan user-managed directory entries.
  await prisma.businessCategory.deleteMany({
    where: {
      slug: { notIn: businessCategories.map((c) => c.slug) },
      businesses: { none: {} },
      serviceListings: { none: {} },
    },
  });

  // Service-desk trades (flagged isService so only the city-home tiles list
  // them). Slugs are prefixed, so this never touches a general category.
  for (const c of serviceCategories) {
    await prisma.businessCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, isService: true },
      create: { ...c, isService: true },
    });
  }

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
