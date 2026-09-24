/** Клиентская проверка нецензурной лексики. Без обращения к API. */

export const CENSORSHIP_TOAST =
  'Соблюдайте культуру речи. Отмеченные поля не прошли цензуру.';

export const CENSORSHIP_FIELD_ERROR = 'Нецензурная лексика';

const PREFIXES = [
  'пере', 'подъ', 'отъ', 'рас', 'раз', 'без', 'над', 'при', 'про',
  'под', 'из', 'ис', 'вы', 'за', 'на', 'по', 'от', 'об', 'до',
  'не', 'ни', 'во', 'вз', 'со', 'у', 'с', 'о', 'а',
].sort((a, b) => b.length - a.length);

const EXACT = new Set([
  'бля',
  'еб',
  'сука',
  'суки',
  'суке',
  'суку',
  'сукой',
  'сукин',
  'хуй',
  'хуя',
  'хуе',
  'хуи',
  'хую',
  'хуем',
  'педик',
]);

const STEMS = [
  'хуй',
  'хуя',
  'хуе',
  'хуи',
  'пизд',
  'бляд',
  'блят',
  'еба',
  'ебе',
  'ебу',
  'еби',
  'ебл',
  'мудак',
  'мудил',
  'мудоз',
  'мудн',
  'пидор',
  'пидар',
  'пидр',
  'педрил',
  'залуп',
  'гондон',
  'гандон',
  'долбоеб',
  'охуе',
  'ахуе',
];

function stripPrefixes(word: string): string {
  let remaining = word;
  for (let i = 0; i < 2; i += 1) {
    const prefix = PREFIXES.find(p => remaining.startsWith(p) && remaining.length - p.length >= 2);
    if (!prefix) break;
    remaining = remaining.slice(prefix.length);
  }
  return remaining;
}

function tokenIsProfane(token: string): boolean {
  if (EXACT.has(token) || STEMS.some(stem => token.startsWith(stem))) return true;
  const stripped = stripPrefixes(token);
  if (stripped === token) return false;
  return EXACT.has(stripped) || STEMS.some(stem => stripped.startsWith(stem));
}

export function hasProfanity(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/ё/g, 'е');
  const tokens = normalized.match(/\p{L}+/gu);
  if (!tokens) return false;
  return tokens.some(tokenIsProfane);
}
