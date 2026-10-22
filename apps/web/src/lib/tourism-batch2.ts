import type { TourismSpot } from './tourism';

const sourceLabel = 'راهنمای گردشگری و ویکی‌پدیای فارسی';

const makeSpot = (city: string, cityLat: number, cityLon: number, item: { id: string; name: string; category: TourismSpot['category']; description: string; duration: string; icon: string; accent: string; imageUrl?: string; imageSourceUrl?: string; imageCredit?: string; imageLicense?: string }, index: number): TourismSpot => ({
  ...item,
  latitude: cityLat + index * 0.004,
  longitude: cityLon + index * 0.004,
  tip: 'ساعت بازدید و وضعیت دسترسی را پیش از حرکت بررسی کنید و به محیط و حریم جاذبه احترام بگذارید.',
  locationLabel: city,
  sourceUrl: `https://fa.wikipedia.org/wiki/${encodeURIComponent(city)}`,
  sourceLabel,
});

export const tourismBatch2: Record<string, TourismSpot[]> = {
  "bafq": [
    makeSpot("بافق", 31.6035, 55.40249, { id: "bafq-1", name: "کویر کاراکال", category: "طبیعت", description: "کویر شن‌زار کاراکال در پیرامون بافق، مقصدی برای تماشای آسمان شب و تجربهٔ چشم‌انداز کویری است.", duration: "نیم‌روز تا یک روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/bafq-irir-60-2032-yazd-bafq-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:IRIR_60-2032_Yazd_-_Bafq,_Iran.jpg", imageCredit: "Kabelleger / David Gubler", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("بافق", 31.6035, 55.40249, { id: "bafq-2", name: "پارک آهن‌شهر", category: "تفریحی", description: "بوستان شهری آهن‌شهر فضای سبز و مسیرهای مناسب برای استراحت و گشت کوتاه خانوادگی دارد.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("بافق", 31.6035, 55.40249, { id: "bafq-3", name: "مسجد جامع بافق", category: "تاریخی", description: "مسجد جامع بافق از بناهای مذهبی و تاریخی شهر است و در بافت مرکزی، نقطه‌ای مناسب برای شناخت معماری محلی به شمار می‌رود.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "sirjan": [
    makeSpot("سیرجان", 29.45137, 55.6809, { id: "sirjan-1", name: "باغ سنگی سیرجان", category: "طبیعت", description: "باغ سنگی یادمانی متفاوت در حوالی سیرجان است که با درختان خشک و آویزهای سنگی، روایت محلی خود را شکل داده است.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/sirjan-stone-garden-sirjan-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Stone_Garden_Sirjan,_Iran.jpg", imageCredit: "Morteza salehi70", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("سیرجان", 29.45137, 55.6809, { id: "sirjan-2", name: "بادگیر چپقی", category: "تاریخی", description: "بادگیر چپقی از نشانه‌های معماری بومی سیرجان و نمونه‌ای دیدنی از سازگاری ساختمان با اقلیم گرم است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("سیرجان", 29.45137, 55.6809, { id: "sirjan-3", name: "بازار سیرجان", category: "غذا و بازار", description: "بازار سنتی سیرجان برای دیدن دادوستد محلی و خرید سوغات و فرآورده‌های پسته مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "rafsanjan": [
    makeSpot("رفسنجان", 30.4067, 55.9939, { id: "rafsanjan-1", name: "خانه حاج‌آقا علی", category: "تاریخی", description: "خانه حاج‌آقا علی در قاسم‌آباد رفسنجان از خانه‌های تاریخی شاخص منطقه با حیاط مرکزی و تزئینات سنتی است.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/rafsanjan-guest-house-of-rafsanjan-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Guest_house_of_Rafsanjan.jpg", imageCredit: "Non Identifiable Author", imageLicense: "Public domain" }, 0),
    makeSpot("رفسنجان", 30.4067, 55.9939, { id: "rafsanjan-2", name: "موزه ریاست جمهوری رفسنجان", category: "فرهنگی", description: "موزهٔ ریاست جمهوری مجموعه‌ای فرهنگی برای آشنایی با تاریخ معاصر و اسناد مرتبط با منطقه است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("رفسنجان", 30.4067, 55.9939, { id: "rafsanjan-3", name: "باغ‌های پسته رفسنجان", category: "طبیعت", description: "باغ‌های پسته پیرامون رفسنجان بخشی از هویت کشاورزی شهر هستند و در فصل برداشت چشم‌انداز جذابی دارند.", duration: "۲ تا ۳ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "jiroft": [
    makeSpot("جیرفت", 28.67806, 57.74056, { id: "jiroft-1", name: "شهر دقیانوس", category: "تاریخی", description: "محوطهٔ شهر باستانی دقیانوس در جلگهٔ جیرفت، بخشی از میراث باستان‌شناسی جنوب‌شرق ایران را معرفی می‌کند.", duration: "۲ تا ۳ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/jiroft-old-jiroft-daqyanoos-jiroft-kerman-.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Old_Jiroft-_Daqyanoos-Jiroft-Kerman-ID_52-_%D8%B4%D9%87%D8%B1_%D9%82%D8%AF%DB%8C%D9%85_%D8%AC%DB%8C%D8%B1%D9%81%D8%AA_-%D8%AF%D9%82%DB%8C%D8%A7%D9%86%D9%88%D8%B3.jpg", imageCredit: "Mhsheikholeslami", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("جیرفت", 28.67806, 57.74056, { id: "jiroft-2", name: "موزه باستان‌شناسی جیرفت", category: "فرهنگی", description: "موزهٔ باستان‌شناسی جیرفت برای آشنایی با یافته‌های تمدن هلیل‌رود و هنرهای کهن منطقه مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("جیرفت", 28.67806, 57.74056, { id: "jiroft-3", name: "رودخانه هلیل‌رود", category: "طبیعت", description: "هلیل‌رود و چشم‌اندازهای پیرامون آن، چهرهٔ سبز و کشاورزی جیرفت را در کنار اقلیم گرم جنوب نشان می‌دهد.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "bam": [
    makeSpot("بم", 29.106, 58.357, { id: "bam-1", name: "ارگ بم", category: "تاریخی", description: "ارگ بم بزرگ‌ترین سازهٔ خشتی جهان و مهم‌ترین جاذبهٔ تاریخی بم است که در فهرست میراث جهانی یونسکو ثبت شده است.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/bam-arg-bam-hg7-3559-2-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Arg-%C3%A9_Bam_(HG7_3559-2).jpg", imageCredit: "Herbert karim masihi", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("بم", 29.106, 58.357, { id: "bam-2", name: "باغ‌های خرمای بم", category: "طبیعت", description: "نخلستان‌های بم چشم‌اندازی شاخص از کشاورزی کویری و محصول خرمای منطقه ارائه می‌کنند.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("بم", 29.106, 58.357, { id: "bam-3", name: "بازار بم", category: "غذا و بازار", description: "بازار محلی بم برای خرید خرما، مرکبات و سوغات جنوب‌شرق و آشنایی با زندگی روزمرهٔ شهر مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "dezful": [
    makeSpot("دزفول", 32.38114, 48.40581, { id: "dezful-1", name: "پل قدیم دزفول", category: "تاریخی", description: "پل قدیم دزفول از یادگارهای مهندسی دورهٔ ساسانی و یکی از نمادهای تاریخی شهر بر رود دز است.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/dezful-diving-in-iran-dezful-city-07-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Diving_in_Iran-Dezful_City_%D8%B9%DA%A9%D8%B3_%D8%B4%DB%8C%D8%B1%D8%AC%D9%87_07.jpg", imageCredit: "Mostafameraji", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("دزفول", 32.38114, 48.40581, { id: "dezful-2", name: "آسیاب‌های آبی دزفول", category: "تاریخی", description: "آسیاب‌های آبی در بستر رود دز مجموعه‌ای از سازه‌های تاریخی مرتبط با آب و آسیابانی را نشان می‌دهند.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("دزفول", 32.38114, 48.40581, { id: "dezful-3", name: "ساحل رود دز", category: "تفریحی", description: "پارک‌ها و ساحل رود دز برای پیاده‌روی، تماشای آب و استراحت در هوای مناسب مقصدی محبوب‌اند.", duration: "۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "bandar-mahshahr": [
    makeSpot("بندر ماهشهر", 30.55655, 49.18852, { id: "bandar-mahshahr-1", name: "خور موسی", category: "طبیعت", description: "خور موسی و آبراه‌های ساحلی پیرامون ماهشهر چشم‌اندازی متفاوت از خلیج فارس و زیست‌بوم خورها دارند.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/bandar-mahshahr-musa-bay-iran-esa372739-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Musa_Bay,_Iran_ESA372739.jpg", imageCredit: "European Space Agency", imageLicense: "CC BY-SA 3.0 igo" }, 0),
    makeSpot("بندر ماهشهر", 30.55655, 49.18852, { id: "bandar-mahshahr-2", name: "پارک ساحلی ماهشهر", category: "تفریحی", description: "پارک ساحلی برای قدم‌زدن و تماشای غروب در فضای شهری بندر مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("بندر ماهشهر", 30.55655, 49.18852, { id: "bandar-mahshahr-3", name: "بازار ماهی‌فروشان", category: "غذا و بازار", description: "بازار ماهی‌فروشان تجربه‌ای نزدیک از خوراک دریایی و اقتصاد بندری منطقه فراهم می‌کند.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "andimeshk": [
    makeSpot("اندیمشک", 32.4615, 48.35368, { id: "andimeshk-1", name: "دریاچه و سد دز", category: "طبیعت", description: "چشم‌انداز دریاچه و سد دز در مسیرهای پیرامون اندیمشک برای طبیعت‌گردی و عکاسی مناسب است.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/andimeshk-andimeshk-khuzestan-province-iran-p.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Andimeshk,_Khuzestan_Province,_Iran_-_panoramio.jpg", imageCredit: "‫سید محمود جوادی‬‎", imageLicense: "CC BY 3.0" }, 0),
    makeSpot("اندیمشک", 32.4615, 48.35368, { id: "andimeshk-2", name: "پل بالارود", category: "تاریخی", description: "پل بالارود از سازه‌های مسیرهای قدیمی منطقه و نقطه‌ای برای شناخت جغرافیای ارتباطی شمال خوزستان است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("اندیمشک", 32.4615, 48.35368, { id: "andimeshk-3", name: "بازار اندیمشک", category: "غذا و بازار", description: "بازار مرکزی اندیمشک برای خرید خوراکی و سوغات خوزستان و تماشای زندگی روزمرهٔ شهر مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "shahriar": [
    makeSpot("شهریار", 35.6589015, 51.0586022, { id: "shahriar-1", name: "امامزاده اسماعیل شهریار", category: "فرهنگی", description: "آرامگاه امامزاده اسماعیل از بناهای زیارتی و شناخته‌شدهٔ شهرستان شهریار است.", duration: "۱ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/shahriar-imam-descendent-ishmael-tomb-1-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Imam-descendent_Ishmael_tomb_1.jpg", imageCredit: "IranianNationalist", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("شهریار", 35.6589015, 51.0586022, { id: "shahriar-2", name: "باغ‌های شهریار", category: "طبیعت", description: "باغ‌های میوه و فضای سبز پیرامون شهریار بخشی از چهرهٔ باغ‌شهری منطقهٔ غرب تهران را می‌سازند.", duration: "۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("شهریار", 35.6589015, 51.0586022, { id: "shahriar-3", name: "پارک شهید کلهر", category: "تفریحی", description: "بوستان‌های شهری شهریار برای پیاده‌روی و برنامهٔ خانوادگی کوتاه مناسب‌اند.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "qods": [
    makeSpot("قدس", 35.7204271, 51.1100769, { id: "qods-1", name: "بوستان‌های شهری قدس", category: "تفریحی", description: "بوستان‌های شهری قدس فضاهایی برای استراحت، پیاده‌روی و استفادهٔ روزمرهٔ خانواده‌ها فراهم می‌کنند.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/qods-ghods-citi-4-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Ghods-Citi_(4).jpg", imageCredit: "Manart", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("قدس", 35.7204271, 51.1100769, { id: "qods-2", name: "بازار قدس", category: "غذا و بازار", description: "بازار محلی قدس برای خرید روزانه و آشنایی با خوراکی‌ها و کسب‌وکارهای محلی مناسب است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("قدس", 35.7204271, 51.1100769, { id: "qods-3", name: "مسجد جامع قدس", category: "فرهنگی", description: "مسجد جامع شهر، یکی از نقاط مهم مذهبی و اجتماعی بافت شهری قدس است.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "malard": [
    makeSpot("ملارد", 35.666763, 50.9790423, { id: "malard-1", name: "پارک شهر ملارد", category: "تفریحی", description: "پارک شهر ملارد فضای سبز و مسیرهایی برای قدم‌زدن و استراحت کوتاه در محدودهٔ شهری دارد.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/malard-shahid-eghtedar-malard-4-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Shahid_eghtedar_malard_4.jpg", imageCredit: "Aghiltohidian", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("ملارد", 35.666763, 50.9790423, { id: "malard-2", name: "باغ‌های ملارد", category: "طبیعت", description: "باغ‌های میوهٔ ملارد چشم‌اندازی از کشاورزی و باغداری دشت غرب تهران ارائه می‌کنند.", duration: "۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("ملارد", 35.666763, 50.9790423, { id: "malard-3", name: "امامزاده ابراهیم ملارد", category: "فرهنگی", description: "امامزاده ابراهیم از مکان‌های زیارتی و محلی شهرستان ملارد است.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "neyshabur": [
    makeSpot("نیشابور", 36.2105604, 58.7922291, { id: "neyshabur-1", name: "آرامگاه خیام", category: "فرهنگی", description: "آرامگاه خیام در باغی آرام، پیوندی میان معماری معاصر، شعر و هویت علمی نیشابور ایجاد کرده است.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/neyshabur-baghrud-road-of-nishapur-gardens-jp.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Baghrud_Road_of_Nishapur,_Gardens.jpg", imageCredit: "Ehsanbasafa", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("نیشابور", 36.2105604, 58.7922291, { id: "neyshabur-2", name: "آرامگاه عطار نیشابوری", category: "فرهنگی", description: "آرامگاه عطار مقصدی مهم برای علاقه‌مندان ادبیات فارسی و تاریخ فرهنگی خراسان است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("نیشابور", 36.2105604, 58.7922291, { id: "neyshabur-3", name: "قدمگاه رضوی", category: "تاریخی", description: "قدمگاه رضوی در مسیر نیشابور از زیارتگاه‌ها و نقاط تاریخی شناخته‌شدهٔ منطقه است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "sabzevar": [
    makeSpot("سبزوار", 36.2134053, 57.6808799, { id: "sabzevar-1", name: "مسجد جامع سبزوار", category: "تاریخی", description: "مسجد جامع سبزوار از بناهای تاریخی مرکز شهر با معماری و کتیبه‌های ارزشمند است.", duration: "۱ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/sabzevar-jameh-mosque-of-sabzevar-01-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Jameh_Mosque_of_Sabzevar_01.jpg", imageCredit: "Ariaamiri", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("سبزوار", 36.2134053, 57.6808799, { id: "sabzevar-2", name: "آرامگاه ابن یمین", category: "فرهنگی", description: "آرامگاه ابن یمین فریومدی یادآور شعر و ادب فارسی در منطقهٔ سبزوار است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("سبزوار", 36.2134053, 57.6808799, { id: "sabzevar-3", name: "بازار سبزوار", category: "غذا و بازار", description: "بازار سنتی سبزوار برای خرید سوغات خراسان و تجربهٔ فضای تجاری بافت قدیم مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "torbat-heydariyeh": [
    makeSpot("تربت حیدریه", 35.2740853, 59.2194494, { id: "torbat-heydariyeh-1", name: "مزار قطب‌الدین حیدر", category: "تاریخی", description: "مجموعهٔ آرامگاهی قطب‌الدین حیدر از بناهای شاخص تربت حیدریه و نمونه‌ای از معماری تاریخی خراسان است.", duration: "۱ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/torbat-heydariyeh-saffronfarm-860808-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Saffronfarm-860808.jpg", imageCredit: "Safa.daneshvar", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("تربت حیدریه", 35.2740853, 59.2194494, { id: "torbat-heydariyeh-2", name: "مزارع زعفران", category: "طبیعت", description: "مزارع زعفران پیرامون تربت حیدریه در فصل گل‌دهی، چشم‌اندازی کم‌نظیر از کشاورزی خراسان می‌سازند.", duration: "۲ تا ۳ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("تربت حیدریه", 35.2740853, 59.2194494, { id: "torbat-heydariyeh-3", name: "بازار تربت حیدریه", category: "غذا و بازار", description: "بازار شهر برای خرید زعفران، خشکبار و سوغات محلی انتخاب مناسبی است.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "kashmar": [
    makeSpot("کاشمر", 35.2446715, 58.4641341, { id: "kashmar-1", name: "قلعه آتشگاه", category: "تاریخی", description: "قلعهٔ آتشگاه بر فراز ارتفاعات پیرامون کاشمر، چشم‌اندازی تاریخی و کوهستانی به منطقه می‌دهد.", duration: "نیم‌روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/kashmar-atashgah-castle2021-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Atashgah_Castle2021.jpg", imageCredit: "POS78", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("کاشمر", 35.2446715, 58.4641341, { id: "kashmar-2", name: "آرامگاه مدرس", category: "فرهنگی", description: "آرامگاه شهید مدرس از مکان‌های فرهنگی و زیارتی شناخته‌شدهٔ کاشمر است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("کاشمر", 35.2446715, 58.4641341, { id: "kashmar-3", name: "امامزاده سید حمزه", category: "فرهنگی", description: "امامزاده سید حمزه از زیارتگاه‌های مهم شهر و بخشی از بافت مذهبی کاشمر است.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "maragheh": [
    makeSpot("مراغه", 37.3913128, 46.2435751, { id: "maragheh-1", name: "رصدخانه مراغه", category: "تاریخی", description: "رصدخانهٔ مراغه از مهم‌ترین مراکز علمی جهان اسلام در سدهٔ هفتم هجری و جاذبهٔ شاخص شهر است.", duration: "۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/maragheh-sunset-over-maragheh-iran-2-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Sunset_over_Maragheh,_Iran_(%D8%BA%D8%B1%D9%88%D8%A8)_2.jpg", imageCredit: "auoob farabi", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("مراغه", 37.3913128, 46.2435751, { id: "maragheh-2", name: "گنبد سرخ", category: "تاریخی", description: "گنبد سرخ از برج‌های آجری دورهٔ سلجوقی و یکی از بناهای ارزشمند معماری مراغه است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("مراغه", 37.3913128, 46.2435751, { id: "maragheh-3", name: "گنبد کبود", category: "تاریخی", description: "گنبد کبود در مجموعهٔ برج‌های تاریخی مراغه، نمونه‌ای دیدنی از آجرکاری و تزئینات معماری است.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "marand": [
    makeSpot("مرند", 38.4306358, 45.7741, { id: "marand-1", name: "بازار مرند", category: "غذا و بازار", description: "بازار مرند برای خرید خشکبار، زردآلو و سوغات آذربایجان و آشنایی با دادوستد محلی مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/marand-apricot-harvest-in-marand-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Apricot_Harvest_in_Marand,_Iran.jpg", imageCredit: "Mina Noei", imageLicense: "CC BY 4.0" }, 0),
    makeSpot("مرند", 38.4306358, 45.7741, { id: "marand-2", name: "باغ‌های زردآلو", category: "طبیعت", description: "باغ‌های زردآلو و مزارع پیرامون مرند بخشی از چشم‌انداز کشاورزی منطقه هستند.", duration: "۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("مرند", 38.4306358, 45.7741, { id: "marand-3", name: "مسجد جامع مرند", category: "تاریخی", description: "مسجد جامع مرند از بناهای مذهبی و تاریخی شهر با ریشه‌های کهن در بافت مرکزی است.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "ahar": [
    makeSpot("اهر", 38.4774934, 47.0662215, { id: "ahar-1", name: "جنگل‌های ارسباران", category: "طبیعت", description: "ارسباران در پیرامون اهر، منطقه‌ای کوهستانی و سرسبز برای طبیعت‌گردی و تماشای تنوع زیستی است.", duration: "نیم‌روز تا یک روز", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/ahar-sheikh-shahab-tomb-2-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Sheikh-shahab_tomb_2.JPG", imageCredit: "Elmju", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("اهر", 38.4774934, 47.0662215, { id: "ahar-2", name: "مقبره شیخ شهاب‌الدین اهری", category: "فرهنگی", description: "مقبرهٔ شیخ شهاب‌الدین اهری از بناهای شاخص عرفانی و تاریخی شهر اهر است.", duration: "۱ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("اهر", 38.4774934, 47.0662215, { id: "ahar-3", name: "بازار تاریخی اهر", category: "غذا و بازار", description: "بازار تاریخی اهر برای دیدن معماری بازارهای آذربایجان و خرید سوغات محلی پیشنهاد می‌شود.", duration: "۱ تا ۲ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "mianeh": [
    makeSpot("میانه", 37.4284148, 47.7058119, { id: "mianeh-1", name: "قلعه دختر میانه", category: "تاریخی", description: "قلعه دختر میانه بر فراز ارتفاعات، یکی از نشانه‌های تاریخی مهم مسیرهای ارتباطی آذربایجان است.", duration: "۲ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/mianeh-qal-e-dokhtar-of-mianeh-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Qal-e-Dokhtar_of_Mianeh,_Iran.jpg", imageCredit: "Armin Abbasi", imageLicense: "CC BY-SA 4.0" }, 0),
    makeSpot("میانه", 37.4284148, 47.7058119, { id: "mianeh-2", name: "کاروانسرای جمال‌آباد", category: "تاریخی", description: "کاروانسرای جمال‌آباد از یادگارهای مسیر تاریخی تبریز–تهران و نمونه‌ای از معماری کاروانسراهاست.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("میانه", 37.4284148, 47.7058119, { id: "mianeh-3", name: "پل دختر میانه", category: "تاریخی", description: "پل دختر میانه سازه‌ای تاریخی بر مسیر رودخانه است که در چشم‌انداز پیرامون شهر دیده می‌شود.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
  "khoy": [
    makeSpot("خوی", 38.5479104, 44.9512397, { id: "khoy-1", name: "آرامگاه شمس تبریزی", category: "تاریخی", description: "آرامگاه شمس تبریزی با منارهٔ آجری خود از نمادهای تاریخی و فرهنگی خوی است.", duration: "۱ ساعت", icon: "🏛️", accent: "#b45309", imageUrl: "/tourism/khoy-khoy-city-iran-jpg.webp", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Khoy_city.iran.jpg", imageCredit: "Aminadrin", imageLicense: "CC BY-SA 3.0" }, 0),
    makeSpot("خوی", 38.5479104, 44.9512397, { id: "khoy-2", name: "بازار تاریخی خوی", category: "غذا و بازار", description: "بازار تاریخی خوی برای دیدن راسته‌های سنتی و خرید سوغات آذربایجان مناسب است.", duration: "۱ تا ۲ ساعت", icon: "🌿", accent: "#15803d" }, 1),
    makeSpot("خوی", 38.5479104, 44.9512397, { id: "khoy-3", name: "پل خاتون خوی", category: "تاریخی", description: "پل خاتون از آثار تاریخی پیرامون خوی و یادگاری از مسیرهای ارتباطی قدیم منطقه است.", duration: "۱ ساعت", icon: "🍽️", accent: "#7c3aed" }, 2),
  ],
};
