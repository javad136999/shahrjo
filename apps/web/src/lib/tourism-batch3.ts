import type { TourismSpot } from './tourism';

const sourceLabel = 'راهنمای گردشگری و ویکی‌پدیای فارسی';

const makeSpot = (city: string, lat: number, lon: number, item: Omit<TourismSpot, 'latitude'|'longitude'|'tip'|'locationLabel'|'sourceUrl'|'sourceLabel'>, index: number): TourismSpot => ({ ...item, latitude: lat + index * 0.004, longitude: lon + index * 0.004, tip: 'ساعت بازدید و وضعیت دسترسی را پیش از حرکت بررسی کنید و به محیط و حریم جاذبه احترام بگذارید.', locationLabel: city, sourceUrl: `https://fa.wikipedia.org/wiki/${encodeURIComponent(city)}`, sourceLabel });

export const tourismBatch3: Record<string, TourismSpot[]> = {
  "bukan": [
    makeSpot("بوکان", 36.5215096, 46.2111837, { id: "bukan-1", name: "مسجد جامع بوکان", category: "تاریخی", description: "مسجد جامع بوکان از بناهای شاخص تاریخی و مذهبی شهر در بافت مرکزی است.", duration: "۱ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/bukan-iran-bukan-qajar-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Iran_Bukan_Qajar.jpg", imageCredit: "Ali Khan Vali", imageLicense: "Public domain" }, 0),
    makeSpot("بوکان", 36.5215096, 46.2111837, { id: "bukan-2", name: "پارک ساحلی بوکان", category: "تفریحی", description: "پارک ساحلی و فضای سبز کنار آب برای قدم‌زدن و استراحت خانوادگی مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("بوکان", 36.5215096, 46.2111837, { id: "bukan-3", name: "بازار بوکان", category: "غذا و بازار", description: "بازار محلی بوکان برای خرید سوغات، خشکبار و آشنایی با خوراک و دادوستد کردی مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "mahabad": [
    makeSpot("مهاباد", 36.7651739, 45.7218136, { id: "mahabad-1", name: "دریاچه و سد مهاباد", category: "طبیعت", description: "دریاچهٔ سد مهاباد چشم‌اندازی کوهستانی و آرام برای عکاسی و طبیعت‌گردی سبک دارد.", duration: "۲ تا ۳ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/mahabad-mahabad-dam-png.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:%D8%B3%D8%AF_%D9%85%D9%87%D8%A7%D8%A8%D8%A7%D8%AF_-_Mahabad_dam.png", imageCredit: "Unknown authorUnknown author", imageLicense: "CC BY 4.0" }, 0),
    makeSpot("مهاباد", 36.7651739, 45.7218136, { id: "mahabad-2", name: "موزهٔ مردم‌شناسی مهاباد", category: "فرهنگی", description: "موزهٔ مردم‌شناسی برای شناخت پوشاک، ابزار و شیوهٔ زندگی مردم منطقهٔ مکریان مناسب است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("مهاباد", 36.7651739, 45.7218136, { id: "mahabad-3", name: "بازار مهاباد", category: "غذا و بازار", description: "بازار مهاباد از مراکز شناخته‌شدهٔ خرید در جنوب آذربایجان غربی و مناسب تهیهٔ سوغات است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "miandoab": [
    makeSpot("میاندوآب", 36.9695588, 46.0993809, { id: "miandoab-1", name: "پارک ساحلی زرینه‌رود", category: "طبیعت", description: "حاشیهٔ زرینه‌رود و فضای سبز اطراف آن، چهرهٔ طبیعی و کشاورزی میاندوآب را نشان می‌دهد.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/miandoab-panoramio-1-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:(((%D9%85%D9%86%D8%B5%D9%88%D8%B1_%D8%A7%D8%A8%D8%A7%D8%AF_)))_-_panoramio_(1).jpg", imageCredit: "auoob farabi", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("میاندوآب", 36.9695588, 46.0993809, { id: "miandoab-2", name: "پل میرزارسول", category: "تاریخی", description: "پل میرزارسول از نشانه‌های تاریخی مسیرهای ارتباطی شهر و پیرامون رودخانه است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("میاندوآب", 36.9695588, 46.0993809, { id: "miandoab-3", name: "بازار میاندوآب", category: "غذا و بازار", description: "بازار مرکزی شهر برای خرید محصولات محلی و تجربهٔ زندگی روزمرهٔ منطقه مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "saqqez": [
    makeSpot("سقز", 36.24992, 46.2735, { id: "saqqez-1", name: "کاروانسرای تاجوانچی", category: "تاریخی", description: "کاروانسرای تاجوانچی از یادگارهای مسیرهای تجاری قدیم و نمونه‌ای از معماری کاروانسراهای کردستان است.", duration: "۱ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/saqqez-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:%DA%A9%D8%A7%D8%B1%D9%88%D9%86%D8%B3%D8%B1%D8%A7%DB%8C_%D8%AA%D8%A7%D8%AC%D9%88%D8%A7%D9%86%DA%86%DB%8C.jpg", imageCredit: "personal album", imageLicense: "Public domain" }, 0),
    makeSpot("سقز", 36.24992, 46.2735, { id: "saqqez-2", name: "پارک کوثر سقز", category: "تفریحی", description: "بوستان کوثر فضای شهری مناسبی برای قدم‌زدن و استراحت در سفر به سقز فراهم می‌کند.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("سقز", 36.24992, 46.2735, { id: "saqqez-3", name: "بازار سقز", category: "غذا و بازار", description: "بازار سقز برای خرید پوشاک، صنایع‌دستی و خوراکی‌های محلی کردستان پیشنهاد می‌شود.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "marivan": [
    makeSpot("مریوان", 35.51829, 46.18298, { id: "marivan-1", name: "دریاچه زریوار", category: "طبیعت", description: "زریوار دریاچه‌ای آب شیرین در نزدیکی مریوان و یکی از مهم‌ترین چشم‌اندازهای طبیعی کردستان است.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/marivan-marivan-zarivar-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Marivan-zarivar-Iran.jpg", imageCredit: "Mr.minoque", imageLicense: "CC BY-SA 2.5" }, 0),
    makeSpot("مریوان", 35.51829, 46.18298, { id: "marivan-2", name: "بازارچهٔ مرزی مریوان", category: "غذا و بازار", description: "بازارچهٔ مرزی مریوان برای خرید سوغات و کالاهای محلی و تجربهٔ فضای مرزی شهر مناسب است.", duration: "۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("مریوان", 35.51829, 46.18298, { id: "marivan-3", name: "پارک ملت مریوان", category: "تفریحی", description: "فضای سبز شهری و مسیرهای کنار دریاچه برای پیاده‌روی عصرگاهی مناسب‌اند.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "baneh": [
    makeSpot("بانه", 35.9975, 45.8853, { id: "baneh-1", name: "چشم‌انداز کوه آربابا", category: "طبیعت", description: "کوه آربابا چشم‌اندازی مرتفع بر شهر بانه و مقصدی مناسب برای تماشای طبیعت زاگرس است.", duration: "۲ تا ۳ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/baneh-baneh-panorama-from-arbaba-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Baneh_panorama_from_Arbaba.jpg", imageCredit: "Peyman14rojhak", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("بانه", 35.9975, 45.8853, { id: "baneh-2", name: "بازار مرزی بانه", category: "غذا و بازار", description: "بازارهای مرزی بانه از شناخته‌شده‌ترین مقصدهای خرید و سوغات در غرب ایران هستند.", duration: "۲ تا ۳ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("بانه", 35.9975, 45.8853, { id: "baneh-3", name: "پارک دوکانان", category: "تفریحی", description: "پارک دوکانان فضای سبز کوهپایه‌ای برای استراحت و تماشای چشم‌انداز بانه فراهم می‌کند.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "qorveh": [
    makeSpot("قروه", 35.1664, 47.80564, { id: "qorveh-1", name: "چشمهٔ آب‌گرم باباگرگر", category: "طبیعت", description: "باباگرگر و چشمهٔ آب‌گرم آن از جاذبه‌های طبیعی پیرامون قروه و مقصدی برای توقف کوتاه هستند.", duration: "۲ تا ۳ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/qorveh-qorveh-urban-planning-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Qorveh_urban_planning.jpg", imageCredit: "Unknown authorUnknown author", imageLicense: "Public domain" }, 0),
    makeSpot("قروه", 35.1664, 47.80564, { id: "qorveh-2", name: "سنگ‌نبشتهٔ قروه", category: "تاریخی", description: "آثار سنگی و محوطه‌های تاریخی پیرامون قروه بخشی از پیشینهٔ سکونت در زاگرس را روایت می‌کنند.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("قروه", 35.1664, 47.80564, { id: "qorveh-3", name: "بازار قروه", category: "غذا و بازار", description: "بازار محلی قروه برای خرید محصولات کشاورزی، لبنیات و سوغات منطقه مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "borujen": [
    makeSpot("بروجن", 31.9719093, 51.291596, { id: "borujen-1", name: "تالاب گندمان", category: "طبیعت", description: "تالاب گندمان از زیست‌بوم‌های مهم چهارمحال‌وبختیاری برای پرندگان و طبیعت‌گردی مسئولانه است.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/borujen-borujen-3-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Borujen_3.jpg", imageCredit: "Khjo", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("بروجن", 31.9719093, 51.291596, { id: "borujen-2", name: "پارک گردشگری بروجن", category: "تفریحی", description: "فضاهای سبز و پارک‌های شهری بروجن برای استراحت و گشت کوتاه خانوادگی مناسب‌اند.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("بروجن", 31.9719093, 51.291596, { id: "borujen-3", name: "بازار بروجن", category: "غذا و بازار", description: "بازار بروجن برای خرید لبنیات، عسل و محصولات محلی چهارمحال‌وبختیاری مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "lordegan": [
    makeSpot("لردگان", 31.5135384, 50.8300461, { id: "lordegan-1", name: "آبشار آتشگاه", category: "طبیعت", description: "آبشارهای آتشگاه در مسیرهای کوهستانی لردگان چشم‌اندازی سرسبز و مناسب طبیعت‌گردی می‌سازند.", duration: "نیم‌روز تا یک روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/lordegan-borujen-3-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Borujen_3.jpg", imageCredit: "Khjo", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("لردگان", 31.5135384, 50.8300461, { id: "lordegan-2", name: "چشمه برم لردگان", category: "تفریحی", description: "چشمهٔ برم در محدودهٔ شهری لردگان فضای آبی و سبز مناسبی برای توقف و استراحت دارد.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("لردگان", 31.5135384, 50.8300461, { id: "lordegan-3", name: "بازار لردگان", category: "غذا و بازار", description: "بازار شهر برای خرید محصولات محلی و آشنایی با خوراک بختیاری پیشنهاد می‌شود.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "farokh-shahr": [
    makeSpot("فرخ‌شهر", 32.2732354, 50.9836849, { id: "farokh-shahr-1", name: "پارک سرچشمهٔ فرخ‌شهر", category: "طبیعت", description: "چشمه‌ها و فضای سبز دامنهٔ کوهستان در پیرامون فرخ‌شهر برای گشت سبک مناسب‌اند.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/farokh-shahr-borujen-3-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Borujen_3.jpg", imageCredit: "Khjo", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("فرخ‌شهر", 32.2732354, 50.9836849, { id: "farokh-shahr-2", name: "مسجد جامع فرخ‌شهر", category: "تاریخی", description: "مسجد جامع شهر از بناهای مذهبی و اجتماعی بافت قدیم فرخ‌شهر است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("فرخ‌شهر", 32.2732354, 50.9836849, { id: "farokh-shahr-3", name: "بازار فرخ‌شهر", category: "غذا و بازار", description: "بازار محلی شهر برای خرید محصولات روستایی و سوغات چهارمحال مناسب است.", duration: "۱ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "farsan": [
    makeSpot("فارسان", 32.2569444, 50.5608333, { id: "farsan-1", name: "چشمه و آبشار پیرغار", category: "طبیعت", description: "پیرغار و آبشار فصلی آن از جاذبه‌های طبیعی شناخته‌شدهٔ شهرستان فارسان است.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/farsan-borujen-3-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Borujen_3.jpg", imageCredit: "Khjo", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("فارسان", 32.2569444, 50.5608333, { id: "farsan-2", name: "سنگ‌نوشته‌های مشروطیت", category: "تاریخی", description: "سنگ‌نوشته‌های پیرغار بخشی از روایت تاریخ مشروطه در چهارمحال‌وبختیاری را ثبت کرده‌اند.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("فارسان", 32.2569444, 50.5608333, { id: "farsan-3", name: "بازار فارسان", category: "غذا و بازار", description: "بازار فارسان برای خرید عسل، لبنیات و محصولات محلی منطقه مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "dogonbadan": [
    makeSpot("دوگنبدان", 30.3586, 50.7981, { id: "dogonbadan-1", name: "تنگهٔ ماغر", category: "طبیعت", description: "تنگهٔ ماغر در پیرامون دوگنبدان چشم‌اندازی کوهستانی و مناسب طبیعت‌گردی فصلی دارد.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/dogonbadan-ghachsaran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Ghachsaran.jpg", imageCredit: "Emakarimi", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("دوگنبدان", 30.3586, 50.7981, { id: "dogonbadan-2", name: "پارک نفت", category: "تفریحی", description: "پارک نفت از فضاهای سبز شهری برای استراحت و برنامهٔ خانوادگی در دوگنبدان است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("دوگنبدان", 30.3586, 50.7981, { id: "dogonbadan-3", name: "بازار دوگنبدان", category: "غذا و بازار", description: "بازار محلی دوگنبدان برای خرید خوراکی و سوغات کهگیلویه‌وبویراحمد مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "dehdasht": [
    makeSpot("دهدشت", 30.79337, 50.56508, { id: "dehdasht-1", name: "بافت تاریخی دهدشت", category: "تاریخی", description: "بافت تاریخی دهدشت نو بخشی ارزشمند از معماری و شهرسازی دورهٔ اسلامی در جنوب‌غرب ایران است.", duration: "۲ تا ۳ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/dehdasht-handkerchief-dance-by-southern-lurs.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Handkerchief_dance_by_Southern_Lurs_in_Dehdasht.jpg", imageCredit: "Shadegan", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("دهدشت", 30.79337, 50.56508, { id: "dehdasht-2", name: "منطقهٔ حفاظت‌شدهٔ خائیز", category: "طبیعت", description: "خائیز در پیرامون دهدشت زیست‌بومی کوهستانی برای طبیعت‌گردی با رعایت ضوابط حفاظتی است.", duration: "نیم‌روز", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("دهدشت", 30.79337, 50.56508, { id: "dehdasht-3", name: "بازار دهدشت", category: "غذا و بازار", description: "بازار دهدشت برای خرید محصولات محلی و آشنایی با فرهنگ خوراک جنوب‌غرب پیشنهاد می‌شود.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "likak": [
    makeSpot("لیکک", 30.8949, 50.0931, { id: "likak-1", name: "چشمه‌های اطراف لیکک", category: "طبیعت", description: "چشمه‌ها و تپه‌های پیرامون لیکک در فصل‌های پربارش برای گشت طبیعت و عکاسی مناسب‌اند.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/likak-tat-r-likak-2022-02-25-12-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Tat%C3%A1r-likak_2022-02-25_(12).jpg", imageCredit: "Szenti Tamás", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("لیکک", 30.8949, 50.0931, { id: "likak-2", name: "فرهنگ بختیاری و بهمئی", category: "فرهنگی", description: "آشنایی با موسیقی، پوشاک و آیین‌های محلی، بخش مهمی از تجربهٔ فرهنگی لیکک است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("لیکک", 30.8949, 50.0931, { id: "likak-3", name: "بازار لیکک", category: "غذا و بازار", description: "بازار محلی لیکک برای خرید محصولات روستایی و خوراکی‌های منطقه مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "madavan": [
    makeSpot("مادوان", 30.71525, 51.54131, { id: "madavan-1", name: "پارک‌ها و چشم‌انداز مادوان", category: "طبیعت", description: "چشم‌اندازهای کوهپایه‌ای پیرامون مادوان، فضای مناسبی برای گشت کوتاه و تماشای طبیعت زاگرس فراهم می‌کنند.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/madavan-tat-r-likak-2022-02-25-12-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Tat%C3%A1r-likak_2022-02-25_(12).jpg", imageCredit: "Szenti Tamás", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("مادوان", 30.71525, 51.54131, { id: "madavan-2", name: "فرهنگ محلی مادوان", category: "فرهنگی", description: "بازدید از فضاهای فرهنگی و آیین‌های محلی، راهی برای شناخت جامعهٔ پیرامون یاسوج است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("مادوان", 30.71525, 51.54131, { id: "madavan-3", name: "بازار مادوان", category: "غذا و بازار", description: "بازارهای محلی مادوان برای خرید محصولات بومی و خوراکی‌های منطقه مناسب‌اند.", duration: "۱ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "shahroud": [
    makeSpot("شاهرود", 36.4195026, 54.9649915, { id: "shahroud-1", name: "جنگل ابر", category: "طبیعت", description: "جنگل ابر در شمال شاهرود یکی از شناخته‌شده‌ترین چشم‌اندازهای جنگلی و مه‌آلود ایران است.", duration: "نیم‌روز تا یک روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/shahroud-shahroud-iran-cloud-forest-panorami.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Shahroud_-_Iran_-_Cloud_Forest_-_panoramio.jpg", imageCredit: "Alireza Javaheri", imageLicense: "CC BY 3.0" }, 0),
    makeSpot("شاهرود", 36.4195026, 54.9649915, { id: "shahroud-2", name: "بازار تاریخی شاهرود", category: "غذا و بازار", description: "بازار تاریخی شاهرود برای دیدن معماری سنتی و خرید سوغات و محصولات محلی مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("شاهرود", 36.4195026, 54.9649915, { id: "shahroud-3", name: "موزهٔ شاهرود", category: "فرهنگی", description: "موزهٔ شاهرود برای آشنایی با تاریخ، مردم‌شناسی و آثار فرهنگی منطقه پیشنهاد می‌شود.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "damghan": [
    makeSpot("دامغان", 36.167451, 54.3379993, { id: "damghan-1", name: "مسجد تاریخانه", category: "تاریخی", description: "مسجد تاریخانهٔ دامغان از کهن‌ترین بناهای مذهبی ایران و نمونه‌ای مهم از معماری آغازین اسلامی است.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/damghan-tarikhaneh-damghan-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Tarikhaneh,_Damghan,_Iran.jpg", imageCredit: "Mehdi Saeidi", imageLicense: "CC BY 2.0" }, 0),
    makeSpot("دامغان", 36.167451, 54.3379993, { id: "damghan-2", name: "چشمه‌علی دامغان", category: "طبیعت", description: "چشمه‌علی و باغ‌های پیرامون آن در مسیر دامغان–ساری مقصدی خوش‌آب‌وهوا برای توقف هستند.", duration: "۲ تا ۳ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("دامغان", 36.167451, 54.3379993, { id: "damghan-3", name: "بازار دامغان", category: "غذا و بازار", description: "بازار دامغان برای خرید پسته، خشکبار و سوغات استان سمنان مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "garmsar": [
    makeSpot("گرمسار", 35.2221321, 52.3385276, { id: "garmsar-1", name: "کویر گرمسار", category: "طبیعت", description: "کویرهای پیرامون گرمسار برای تماشای آسمان شب و چشم‌اندازهای نمکی و شنی مناسب‌اند.", duration: "نیم‌روز تا یک روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/garmsar-the-cistern-in-garmsar-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:The_cistern_in_Garmsar,Iran.jpg", imageCredit: "Reza1rameh", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("گرمسار", 35.2221321, 52.3385276, { id: "garmsar-2", name: "آب‌انبار گرمسار", category: "تاریخی", description: "آب‌انبارهای تاریخی گرمسار بخشی از معماری سازگار با اقلیم خشک کویری هستند.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("گرمسار", 35.2221321, 52.3385276, { id: "garmsar-3", name: "بازار گرمسار", category: "غذا و بازار", description: "بازار گرمسار برای خرید محصولات کویری، خربزه و سوغات محلی مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
  "mehdishahr": [
    makeSpot("مهدی‌شهر", 35.7108029, 53.3555769, { id: "mehdishahr-1", name: "غار دربند مهدی‌شهر", category: "طبیعت", description: "غار دربند از جاذبه‌های طبیعی شاخص مهدی‌شهر و مقصدی برای غارنوردی سبک با راهنمای محلی است.", duration: "۲ تا ۳ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/mehdishahr-darband-cave-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Darband_Cave.jpg", imageCredit: "user:Rahiane sHOMAL", imageLicense: "FAL" }, 0),
    makeSpot("مهدی‌شهر", 35.7108029, 53.3555769, { id: "mehdishahr-2", name: "شهمیرزاد", category: "طبیعت", description: "شهمیرزاد با باغ‌های گردو و هوای خنک، یکی از مقصدهای خوش‌آب‌وهوای نزدیک مهدی‌شهر است.", duration: "نیم‌روز", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("مهدی‌شهر", 35.7108029, 53.3555769, { id: "mehdishahr-3", name: "بازار مهدی‌شهر", category: "غذا و بازار", description: "بازار محلی برای خرید لبنیات، گردو و سوغات کوهستانی استان سمنان مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#b45309" }, 2),
  ],
};
