import type { City } from '@/lib/types';

export type TourismCategory = 'طبیعت' | 'تاریخی' | 'فرهنگی' | 'تفریحی' | 'غذا و بازار';

export interface TourismSpot {
  id: string;
  name: string;
  category: TourismCategory;
  description: string;
  latitude: number;
  longitude: number;
  icon: string;
  accent: string;
  duration: string;
  tip: string;
}

type SpotSeed = Omit<TourismSpot, 'latitude' | 'longitude'> & { offsetLat: number; offsetLng: number };

const citySpots: Record<string, SpotSeed[]> = {
  jam: [
    { id: 'jam-naraki', name: 'آبشار و تنگهٔ نارک', category: 'طبیعت', description: 'مسیر کوهستانی خوش‌آب‌وهوا برای یک نیم‌روز طبیعت‌گردی در حوالی جم.', icon: '🏞️', accent: '#15803d', duration: 'نیم‌روز', tip: 'کفش مناسب و آب آشامیدنی همراه داشته باشید.', offsetLat: 0.025, offsetLng: 0.01 },
    { id: 'jam-gandomkar', name: 'روستای گندمکار', category: 'طبیعت', description: 'چشم‌اندازهای سبز و هوای خنک؛ انتخابی عالی برای پیک‌نیک خانوادگی.', icon: '🌿', accent: '#0f766e', duration: '۳ تا ۴ ساعت', tip: 'صبح زود بروید تا هوای خنک‌تری داشته باشید.', offsetLat: 0.038, offsetLng: -0.02 },
    { id: 'jam-old-bazaar', name: 'بازار و بافت قدیم جم', category: 'غذا و بازار', description: 'برای چشیدن طعم‌های محلی و خرید سوغات و محصولات بومی شهر.', icon: '🧺', accent: '#b45309', duration: '۱ تا ۲ ساعت', tip: 'برای خرید محصولات محلی، عصرها زمان مناسب‌تری است.', offsetLat: -0.006, offsetLng: 0.004 },
    { id: 'jam-city-park', name: 'پارک و فضای سبز شهر جم', category: 'تفریحی', description: 'مناسب قدم‌زدن عصرگاهی، استراحت و وقت‌گذرانی خانوادگی.', icon: '🌳', accent: '#0369a1', duration: '۱ تا ۲ ساعت', tip: 'غروب‌ها فضای پارک حال‌وهوای دلنشین‌تری دارد.', offsetLat: -0.012, offsetLng: -0.012 },
  ],
  bushehr: [
    { id: 'bushehr-coast', name: 'ساحل و بافت تاریخی بوشهر', category: 'فرهنگی', description: 'ترکیب معماری جنوبی، دریا و کافه‌های ساحلی برای یک گشت شهری متفاوت.', icon: '🌊', accent: '#0369a1', duration: 'نیم‌روز', tip: 'تماشای غروب در ساحل را از دست ندهید.', offsetLat: 0.004, offsetLng: 0.008 },
    { id: 'bushehr-deir', name: 'بازار بوشهر', category: 'غذا و بازار', description: 'محل آشنایی با خوراکی‌ها، ادویه‌ها و حال‌وهوای بازارهای جنوب.', icon: '🧺', accent: '#b45309', duration: '۲ ساعت', tip: 'برای خرید سوغات جنوبی چانه‌زنی بخشی از تجربه است.', offsetLat: 0.012, offsetLng: -0.004 },
  ],
  shiraz: [
    { id: 'shiraz-hafez', name: 'آرامگاه حافظ', category: 'فرهنگی', description: 'یکی از محبوب‌ترین مقصدهای فرهنگی شیراز در باغی آرام و شاعرانه.', icon: '📜', accent: '#7c3aed', duration: '۱ تا ۲ ساعت', tip: 'شب‌های بهاری فضای مجموعه بسیار تماشایی است.', offsetLat: 0.02, offsetLng: 0.02 },
    { id: 'shiraz-narenjestan', name: 'باغ نارنجستان قوام', category: 'تاریخی', description: 'عمارت قاجاری و باغی پر از عطر بهارنارنج در قلب شیراز.', icon: '🏛️', accent: '#b45309', duration: '۱ ساعت', tip: 'بهار، بهترین فصل بازدید از باغ است.', offsetLat: -0.015, offsetLng: 0.01 },
    { id: 'shiraz-eriam', name: 'باغ ارم', category: 'طبیعت', description: 'باغی تاریخی با درختان سرسبز و معماری چشم‌نواز.', icon: '🌺', accent: '#15803d', duration: '۲ ساعت', tip: 'صبح‌ها برای عکاسی نور ملایم‌تری دارد.', offsetLat: 0.03, offsetLng: -0.015 },
  ],
  isfahan: [
    { id: 'isfahan-naqshejahan', name: 'میدان نقش جهان', category: 'تاریخی', description: 'شاهکار معماری صفوی و نقطهٔ شروع عالی برای گشت‌وگذار در اصفهان.', icon: '🏛️', accent: '#b45309', duration: 'نیم‌روز', tip: 'بازار قیصریه و بناهای اطراف را هم در برنامه بگذارید.', offsetLat: 0.01, offsetLng: 0.01 },
    { id: 'isfahan-si-o-se-pol', name: 'سی‌وسه‌پل', category: 'فرهنگی', description: 'پل تاریخی زاینده‌رود؛ مقصد محبوب برای قدم‌زدن و عکاسی.', icon: '🌉', accent: '#0369a1', duration: '۱ ساعت', tip: 'قبل از رفتن وضعیت آب زاینده‌رود را بررسی کنید.', offsetLat: -0.02, offsetLng: 0.015 },
  ],
  yazd: [
    { id: 'yazd-old-town', name: 'بافت تاریخی یزد', category: 'تاریخی', description: 'کوچه‌های خشتی، بادگیرها و خانه‌های سنتی در قلب شهر جهانی یزد.', icon: '🧱', accent: '#b45309', duration: 'نیم‌روز', tip: 'گشت پیاده در ساعات خنک عصر لذت‌بخش‌تر است.', offsetLat: 0.01, offsetLng: 0.01 },
    { id: 'yazd-dolatabad', name: 'باغ دولت‌آباد', category: 'طبیعت', description: 'باغ ایرانی و بادگیر بلند آن؛ ترکیبی دیدنی از معماری و طبیعت.', icon: '🌴', accent: '#15803d', duration: '۲ ساعت', tip: 'برای دیدن روشن‌شدن بادگیر هنگام غروب زمان بگذارید.', offsetLat: -0.02, offsetLng: -0.01 },
  ],
  tehran: [
    { id: 'tehran-golestan', name: 'کاخ گلستان', category: 'تاریخی', description: 'مجموعه‌ای باشکوه از معماری قاجار در مرکز تاریخی تهران.', icon: '🏛️', accent: '#b45309', duration: '۲ تا ۳ ساعت', tip: 'بازدید از تالارهای آینه را در اولویت قرار دهید.', offsetLat: 0.01, offsetLng: 0.01 },
    { id: 'tehran-tabiat', name: 'پل طبیعت', category: 'تفریحی', description: 'پل پیاده‌راه با چشم‌انداز شهری و دسترسی به پارک‌های اطراف.', icon: '🌉', accent: '#0369a1', duration: '۲ ساعت', tip: 'غروب و شب بهترین زمان تماشای چراغ‌های شهر است.', offsetLat: -0.02, offsetLng: 0.02 },
  ],
  mashhad: [
    { id: 'mashhad-reza', name: 'حرم امام رضا (ع)', category: 'فرهنگی', description: 'مهم‌ترین مقصد زیارتی مشهد با معماری و صحن‌های تماشایی.', icon: '🕌', accent: '#b45309', duration: 'نیم‌روز', tip: 'برای ورود، قوانین و ساعات مجموعه را از منبع رسمی بررسی کنید.', offsetLat: 0.01, offsetLng: 0.01 },
    { id: 'mashhad-kang', name: 'روستای کَنگ', category: 'طبیعت', description: 'روستایی پلکانی در نزدیکی مشهد برای تجربهٔ طبیعت و معماری بومی.', icon: '⛰️', accent: '#15803d', duration: 'یک روز', tip: 'برای مسیر کوهستانی کفش مناسب همراه داشته باشید.', offsetLat: -0.08, offsetLng: -0.1 },
  ],
  kerman: [
    { id: 'kerman-shazdeh', name: 'باغ شاهزاده ماهان', category: 'طبیعت', description: 'باغ ایرانی پلکانی با آب‌نماها و چشم‌انداز کوهستان.', icon: '🌺', accent: '#15803d', duration: '۳ ساعت', tip: 'در فصل بهار باغ سرسبزتر و خنک‌تر است.', offsetLat: -0.2, offsetLng: 0.3 },
    { id: 'kerman-ganjali', name: 'مجموعه گنجعلی‌خان', category: 'تاریخی', description: 'بازار، حمام و معماری تاریخی در مرکز بافت قدیم کرمان.', icon: '🧱', accent: '#b45309', duration: '۳ ساعت', tip: 'بازار سنتی را با زمان کافی و پیاده ببینید.', offsetLat: 0.01, offsetLng: 0.01 },
  ],
  tabriz: [
    { id: 'tabriz-bazaar', name: 'بازار تاریخی تبریز', category: 'غذا و بازار', description: 'یکی از بزرگ‌ترین بازارهای سرپوشیدهٔ تاریخی جهان با حجره‌های متنوع.', icon: '🧺', accent: '#b45309', duration: '۳ ساعت', tip: 'برای پیدا کردن مسیرها از نقشه و تابلوهای بازار کمک بگیرید.', offsetLat: 0.01, offsetLng: 0.01 },
    { id: 'tabriz-elongoli', name: 'ائل‌گلی', category: 'تفریحی', description: 'پارک و عمارت نمادین تبریز برای قدم‌زدن و استراحت.', icon: '🌳', accent: '#0369a1', duration: '۲ ساعت', tip: 'صبح زود یا عصر زمان مناسب‌تری برای پیاده‌روی است.', offsetLat: -0.06, offsetLng: 0.08 },
  ],
};

export function getTourismSpots(city: City): TourismSpot[] {
  const seeds = citySpots[city.slug] ?? [
    { id: `${city.slug}-center`, name: `مرکز دیدنی ${city.name}`, category: 'فرهنگی' as const, description: `برای شروع گشت‌وگذار در ${city.name} و آشنایی با حال‌وهوای شهر.`, icon: '🧭', accent: '#0e7a5f', duration: '۱ تا ۲ ساعت', tip: 'قبل از حرکت، ساعات فعالیت و مسیر را بررسی کنید.', offsetLat: 0, offsetLng: 0 },
    { id: `${city.slug}-market`, name: `بازار محلی ${city.name}`, category: 'غذا و بازار' as const, description: `طعم‌ها و سوغات محلی ${city.name} را در بازار شهر تجربه کنید.`, icon: '🧺', accent: '#b45309', duration: '۲ ساعت', tip: 'برای خرید سوغات، از فروشنده‌های محلی راهنمایی بگیرید.', offsetLat: 0.006, offsetLng: 0.006 },
    { id: `${city.slug}-park`, name: `پارک مرکزی ${city.name}`, category: 'تفریحی' as const, description: `مناسب قدم‌زدن و استراحت کوتاه در برنامهٔ سفر به ${city.name}.`, icon: '🌳', accent: '#15803d', duration: '۱ ساعت', tip: 'عصرها معمولاً زمان دلپذیرتری برای بازدید است.', offsetLat: -0.006, offsetLng: -0.004 },
  ];
  return seeds.map(({ offsetLat, offsetLng, ...spot }) => ({ ...spot, latitude: (city.latitude ?? 0) + offsetLat, longitude: (city.longitude ?? 0) + offsetLng }));
}

export const tourismCategories: Array<{ label: TourismCategory | 'همه'; icon: string }> = [
  { label: 'همه', icon: '✨' },
  { label: 'طبیعت', icon: '🌿' },
  { label: 'تاریخی', icon: '🏛️' },
  { label: 'فرهنگی', icon: '🎭' },
  { label: 'تفریحی', icon: '🎡' },
  { label: 'غذا و بازار', icon: '🍽️' },
];
