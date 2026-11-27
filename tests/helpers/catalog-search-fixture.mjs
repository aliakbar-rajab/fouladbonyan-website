const mockRow = (id, title, size, factory) => ({
  id,
  title,
  size,
  standard: "A3",
  grade: "St37",
  branchLength: "12",
  form: "شاخه",
  approximateWeight: "20",
  delivery: "تهران",
  unit: "کیلوگرم",
  factory,
  price: 55_000,
  percent: 1.5,
  status: "up",
  updatedAt: 1_700_000_000,
  updatedDate: "۱۴۰۲/۰۸/۲۳",
  specifications: [{ label: "ضخامت", value: "2mm" }],
});

const mockCategory = (id, label, rows) => ({
  id,
  label,
  groupingLabel: "کارخانه",
  specificationLabel: "استاندارد",
  sourceTitle: label,
  sourceUrl: "https://example.test/source",
  summary: {
    date: "امروز",
    min: 50_000,
    max: 60_000,
    average: 55_000,
    percent: 1.5,
    status: "up",
  },
  filters: {
    sizes: [...new Set(rows.map((r) => r.size))],
    factories: [...new Set(rows.map((r) => r.factory))],
  },
  factories: [...new Set(rows.map((r) => r.factory))].map((factoryName) => ({
    name: factoryName,
    updatedAt: 1_700_000_000,
    updatedDate: "۱۴۰۲/۰۸/۲۳",
    rows: rows.filter((r) => r.factory === factoryName),
  })),
});

export const mockCatalogs = [
  {
    id: "rebar",
    label: "میلگرد",
    initialCategoryId: "ribbed",
    fetchedAt: "2026-07-27T10:00:00.000Z",
    sourceName: "منبع آزمایشی",
    sourceHome: "https://example.test/",
    taxRate: 0.1,
    categories: [
      mockCategory("ribbed", "میلگرد آجدار", [
        mockRow(1, "میلگرد آجدار ۱۴ نیشابور", "14", "نیشابور"),
        mockRow(2, "میلگرد آجدار ۱۶ اصفهان", "16", "ذوب‌آهن اصفهان"),
      ]),
      mockCategory("simple", "میلگرد ساده", [
        mockRow(3, "میلگرد ساده ۱۰ کویر کاشان", "10", "کویر کاشان"),
      ]),
    ],
  },
  {
    id: "beam",
    label: "تیرآهن",
    initialCategoryId: "beam",
    fetchedAt: "2026-07-27T10:00:00.000Z",
    sourceName: "منبع آزمایشی",
    sourceHome: "https://example.test/",
    taxRate: 0.1,
    categories: [
      mockCategory("beam", "تیرآهن IPE", [
        mockRow(4, "تیرآهن ۱۸ فایکو", "18", "فایکو"),
      ]),
    ],
  },
];
