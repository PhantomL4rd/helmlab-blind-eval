/**
 * Mechanical hiragana → romaji (modified Hepburn, no macrons — long vowels stay as digraphs
 * like "ou"/"uu" rather than "ō"/"ū", since this is for plain-ASCII display, not scholarly
 * transliteration). Every `reading` field in traditional-colors.json is pure hiragana, so a
 * fixed lookup table covers the whole dataset deterministically — no heuristics needed.
 */
const YOON = {
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
};

const GOJUON = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  ゐ: 'wi',
  ゑ: 'we',
  を: 'wo',
  ん: 'n',
};

const SOKUON = 'っ';

export function toRomaji(hiragana) {
  let out = '';
  let i = 0;
  while (i < hiragana.length) {
    const twoChar = hiragana.slice(i, i + 2);
    if (YOON[twoChar]) {
      out += YOON[twoChar];
      i += 2;
      continue;
    }

    const ch = hiragana[i];
    if (ch === SOKUON) {
      const next = hiragana.slice(i + 1, i + 3);
      const nextRomaji = YOON[next] ?? GOJUON[hiragana[i + 1]];
      if (nextRomaji) out += nextRomaji[0];
      i += 1;
      continue;
    }

    out += GOJUON[ch] ?? ch;
    i += 1;
  }
  return out;
}
