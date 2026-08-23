/**
 * German Language Moderation Patterns
 * Patterns for detecting inappropriate content in German
 */

/**
 * German profanity patterns
 * These patterns detect common German profanity with obfuscation attempts
 */
export const PROFANITY_PATTERNS_DE: string[] = [
  // Scheiße variations
  '\\b(s+[\\W_]*c+[\\W_]*h+[\\W_]*[e3]+[\\W_]*[i1!]+[\\W_]*[sß]+[\\W_]*e+[rn]?)\\b',
  '\\b(s+[\\W_]*c+[\\W_]*h+[\\W_]*e+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*s+[\\W_]*e+[rn]?)\\b',

  // Arsch variations (Arschlöcher plural)
  '\\b(a+[\\W_]*r+[\\W_]*s+[\\W_]*c+[\\W_]*h+)\\b',
  '\\b(a+[\\W_]*r+[\\W_]*s+[\\W_]*c+[\\W_]*h+[\\W_]*l+[\\W_]*[o0ö]+[\\W_]*c+[\\W_]*h+[\\W_]*e?[\\W_]*r?)\\b',

  // Fick variations (ficken, ficker)
  '\\b(f+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*k+[en]*)\\b',

  // Schlampe variations (Schlampen plural)
  '\\b(s+[\\W_]*c+[\\W_]*h+[\\W_]*l+[\\W_]*a+[\\W_]*m+[\\W_]*p+[\\W_]*e+[ns]?)\\b',

  // Hurensohn variations (Hurensöhne plural)
  '\\b(h+[\\W_]*u+[\\W_]*r+[\\W_]*e+[\\W_]*n+[\\W_]*s+[\\W_]*[o0öœ]+[\\W_]*h+[\\W_]*n+[\\W_]*e?)\\b',

  // Fotze variations (Fotzen plural)
  '\\b(f+[\\W_]*[o0]+[\\W_]*t+[\\W_]*z+[\\W_]*e+[ns]?)\\b',

  // Miststück variations
  '\\b(m+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*t+[\\W_]*s+[\\W_]*t+[\\W_]*ü+[\\W_]*c+[\\W_]*k+[es]?)\\b',
  '\\b(m+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*t+[\\W_]*s+[\\W_]*t+[\\W_]*u+[\\W_]*e+[\\W_]*c+[\\W_]*k+[es]?)\\b',

  // Wichser variations (Wichser plural is same)
  '\\b(w+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*h+[\\W_]*s+[\\W_]*e+[\\W_]*r+[ns]?)\\b',

  // Dummkopf variations (Dummköpfe plural)
  '\\b(d+[\\W_]*u+[\\W_]*m+[\\W_]*m+[\\W_]*k+[\\W_]*[o0öœ]+[\\W_]*p+[\\W_]*f+[\\W_]*e?)\\b',

  // Schwanz variations (Schwänze plural)
  '\\b(s+[\\W_]*c+[\\W_]*h+[\\W_]*w+[\\W_]*[aä]+[\\W_]*n+[\\W_]*z+[\\W_]*e?)\\b',

  // Mistkerl variations (Mistkerle plural)
  '\\b(m+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*t+[\\W_]*k+[\\W_]*e+[\\W_]*r+[\\W_]*l+[\\W_]*e?)\\b',

  // Penner variations
  '\\b(p+[\\W_]*e+[\\W_]*n+[\\W_]*n+[\\W_]*e+[\\W_]*r+[ns]?)\\b',

  // Hure variations (Huren plural)
  '\\b(h+[\\W_]*u+[\\W_]*r+[\\W_]*e+[ns]?)\\b',
];

/**
 * German hate speech patterns
 * These detect hate speech, slurs, and discriminatory language
 */
export const HATE_SPEECH_PATTERNS_DE: string[] = [
  // Nazi-related terms (Nazis plural)
  '\\b(n+[\\W_]*a+[\\W_]*z+[\\W_]*[i1!]+s?)\\b',
  '\\b(h+[\\W_]*[i1!]+[\\W_]*t+[\\W_]*l+[\\W_]*e+[\\W_]*r+)\\b',
  '\\b(j+[\\W_]*u+[\\W_]*d+[\\W_]*e+[ns]?)\\b',

  // Hate-related terms
  '\\b(h+[\\W_]*a+[\\W_]*s+[\\W_]*s+)\\b',

  // Racial slurs (Kanaken plural)
  '\\b(k+[\\W_]*a+[\\W_]*n+[\\W_]*a+[\\W_]*k+[\\W_]*e+[ns]?)\\b',

  // Homophobic slurs (Schwuchteln plural)
  '\\b(s+[\\W_]*c+[\\W_]*h+[\\W_]*w+[\\W_]*u+[\\W_]*c+[\\W_]*h+[\\W_]*t+[\\W_]*e+[\\W_]*l+[ns]?)\\b',
  '\\b(t+[\\W_]*u+[\\W_]*n+[\\W_]*t+[\\W_]*e+[ns]?)\\b',

  // Xenophobic terms (Ausländer plural is same)
  '\\b(a+[\\W_]*u+[\\W_]*s+[\\W_]*l+[\\W_]*ä+[\\W_]*n+[\\W_]*d+[\\W_]*e+[\\W_]*r+[ns]?)\\b',
  '\\b(a+[\\W_]*u+[\\W_]*s+[\\W_]*l+[\\W_]*a+[\\W_]*e+[\\W_]*n+[\\W_]*d+[\\W_]*e+[\\W_]*r+[ns]?)\\b',
  '\\b(z+[\\W_]*[i1!]+[\\W_]*g+[\\W_]*e+[\\W_]*u+[\\W_]*n+[\\W_]*e+[\\W_]*r+[ns]?)\\b',

  // Ableist slurs
  '\\b(b+[\\W_]*e+[\\W_]*h+[\\W_]*[i1!]+[\\W_]*n+[\\W_]*d+[\\W_]*e+[\\W_]*r+[\\W_]*t+[en]?)\\b',
  '\\b(k+[\\W_]*r+[\\W_]*ü+[\\W_]*p+[\\W_]*p+[\\W_]*e+[\\W_]*l+[ns]?)\\b',
  '\\b(k+[\\W_]*r+[\\W_]*u+[\\W_]*e+[\\W_]*p+[\\W_]*p+[\\W_]*e+[\\W_]*l+[ns]?)\\b',

  // Misogynistic terms (Schlampen, Nutten plural)
  '\\b(s+[\\W_]*c+[\\W_]*h+[\\W_]*l+[\\W_]*a+[\\W_]*m+[\\W_]*p+[\\W_]*e+[ns]?)\\b',
  '\\b(n+[\\W_]*u+[\\W_]*t+[\\W_]*t+[\\W_]*e+[ns]?)\\b',
];

/**
 * German spam patterns
 * These detect spam, advertising, and suspicious content
 */
export const SPAM_PATTERNS_DE: string[] = [
  // Discord invite links (universal)
  '(discord\\.gg/|discordapp\\.com/invite/)',

  // Common spam phrases
  '(gratis\\s+nitro)',
  '(fordere\\s+dein)',
  '(klick\\s+hier)',
  '(besuche\\s+mein)',
  '(schau\\s+dir\\s+mein)',

  // Giveaway spam
  '(gratis\\s+gewinnspiel)',
  '(gewinne\\s+kostenlos)',
  '(geschenk\\s+gratis)',

  // Suspicious repetition (universal)
  '\\b(\\w+)\\s+\\1\\s+\\1',

  // Advertising
  '(kaufe\\s+jetzt)',
  '(begrenztes\\s+angebot)',
  '(begrenzte\\s+zeit)',
  '(verpasse\\s+nicht)',

  // Crypto/scam keywords
  '(crypto\\s+gewinnspiel)',
  '(sende\\s+btc)',
  '(verdopple\\s+dein)',
];
