/**
 * Visual stand-ins for unpublished homepage modules (foto galeri, video
 * galeri, astroloji). Used only when APP_ENV is development and the live
 * query returned nothing — never mixed with real published cards.
 */
export const HOMEPAGE_PREVIEW_STILLS = {
  event: "/media/qa/hero-event.jpg",
  portrait: "/media/qa/hero-portrait.jpg",
  visual: "/media/qa/visual-hero.jpg",
} as const;

export const HOMEPAGE_PREVIEW_GALLERIES = [
  {
    key: "kirmizi-hali",
    title: "Kırmızı halı: sezonun en dikkat çeken kareleri",
    category: "Ünlüler",
    imageCount: 18,
    imageSrc: HOMEPAGE_PREVIEW_STILLS.event,
    objectPosition: "center 22%",
  },
  {
    key: "set-arasi",
    title: "Set arası: dizi çekimlerinden kareler",
    category: "Diziler",
    imageCount: 12,
    imageSrc: HOMEPAGE_PREVIEW_STILLS.portrait,
    objectPosition: "center 18%",
  },
  {
    key: "sahne-isiklari",
    title: "Sahne ışıkları: konser ve ödül gecesi",
    category: "Gündem",
    imageCount: 24,
    imageSrc: HOMEPAGE_PREVIEW_STILLS.visual,
    objectPosition: "center 40%",
  },
  {
    key: "yaz-stili",
    title: "Yaz sezonu: sokak stili ve tatil kareleri",
    category: "Galeri",
    imageCount: 16,
    imageSrc: HOMEPAGE_PREVIEW_STILLS.event,
    objectPosition: "center 68%",
  },
] as const;

export const HOMEPAGE_PREVIEW_VIDEOS = [
  {
    key: "final-sahnesi",
    title: "Kamera arkası: final sahnesi nasıl çekildi?",
    category: "Diziler",
    duration: "03:24",
    imageSrc: HOMEPAGE_PREVIEW_STILLS.visual,
    objectPosition: "center 30%",
    featured: true,
  },
  {
    key: "ilk-roportaj",
    title: "Kırmızı halı sonrası ilk açıklama",
    category: "Ünlüler",
    duration: "01:48",
    imageSrc: HOMEPAGE_PREVIEW_STILLS.portrait,
    objectPosition: "center 20%",
    featured: false,
  },
  {
    key: "moda-haftasi",
    title: "Moda haftasından 60 saniye",
    category: "Gündem",
    duration: "01:02",
    imageSrc: HOMEPAGE_PREVIEW_STILLS.event,
    objectPosition: "center 45%",
    featured: false,
  },
  {
    key: "set-gunlukleri",
    title: "Set günlükleri: yeni sezon hazırlığı",
    category: "Video",
    duration: "02:16",
    imageSrc: HOMEPAGE_PREVIEW_STILLS.visual,
    objectPosition: "center 70%",
    featured: false,
  },
] as const;

export const HOMEPAGE_PREVIEW_HOROSCOPES = [
  {
    key: "aslan",
    sign: "Aslan",
    dates: "23 Temmuz – 22 Ağustos",
    teaser:
      "Bu hafta görünürlüğünüz artıyor. Sahneye çıkın; sözü kısa tutun, etkiyi uzun bırakın.",
    featured: true,
  },
  {
    key: "koc",
    sign: "Koç",
    dates: "21 Mart – 19 Nisan",
    teaser: "Tempo yüksek. Bir kapıyı zorlamak yerine doğru zamanı bekleyin.",
    featured: false,
  },
  {
    key: "terazi",
    sign: "Terazi",
    dates: "23 Eylül – 22 Ekim",
    teaser: "İlişkilerde denge arayışı var. Net bir cümle her şeyi yerli yerine koyar.",
    featured: false,
  },
  {
    key: "yay",
    sign: "Yay",
    dates: "22 Kasım – 21 Aralık",
    teaser: "Yeni bir plan zihninizde netleşiyor. İlk adımı küçük tutun.",
    featured: false,
  },
  {
    key: "balik",
    sign: "Balık",
    dates: "19 Şubat – 20 Mart",
    teaser: "Sezgi güçlü. Gürültüden uzak bir saat, haftanın en verimli ânı olabilir.",
    featured: false,
  },
] as const;
