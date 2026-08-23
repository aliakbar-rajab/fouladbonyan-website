const ones = [
  "", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه",
  "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده",
  "هفده", "هجده", "نوزده",
];
const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const hundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function threeDigitsToWords(value: number) {
  const parts: string[] = [];
  if (value >= 100) parts.push(hundreds[Math.floor(value / 100)]);
  const remainder = value % 100;
  if (remainder < 20) {
    if (remainder) parts.push(ones[remainder]);
  } else {
    parts.push(tens[Math.floor(remainder / 10)]);
    if (remainder % 10) parts.push(ones[remainder % 10]);
  }
  return parts.join(" و ");
}

export function rialToWords(value: number) {
  if (!value || value <= 0 || !Number.isFinite(value)) return "صفر ریال";
  const groups: string[] = [];
  let remaining = Math.round(value);
  let scaleIndex = 0;

  while (remaining > 0 && scaleIndex < scales.length) {
    const group = remaining % 1000;
    if (group) {
      groups.unshift(
        `${threeDigitsToWords(group)}${scales[scaleIndex] ? ` ${scales[scaleIndex]}` : ""}`,
      );
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  return `${groups.join(" و ")} ریال`;
}
