/**
 * French Language Moderation Patterns
 * Patterns for detecting inappropriate content in French
 */

/**
 * French profanity patterns
 * These patterns detect common French profanity with obfuscation attempts
 */
export const PROFANITY_PATTERNS_FR: string[] = [
  // Merde variations (merdes plural)
  '\\b(m+[\\W_]*e+[\\W_]*r+[\\W_]*d+[\\W_]*e+s?)\\b',

  // Putain/Pute variations (putes plural)
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*a+[\\W_]*[i1!]+[\\W_]*n+s?)\\b',
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*e+s?)\\b',

  // Con variations (cons plural)
  '\\b(c+[\\W_]*[o0]+[\\W_]*n+)\\b',
  '\\b(c+[\\W_]*[o0]+[\\W_]*n+[\\W_]*n+[\\W_]*a+[\\W_]*[r\\*]+[\\W_]*d+s?)\\b',

  // Salaud variations (salauds plural)
  '\\b(s+[\\W_]*a+[\\W_]*l+[\\W_]*a+[\\W_]*u+[\\W_]*d+s?)\\b',
  '\\b(s+[\\W_]*a+[\\W_]*l+[\\W_]*[o0]+[\\W_]*p+[\\W_]*e+s?)\\b',

  // Bordel variations (bordels plural)
  '\\b(b+[\\W_]*[o0]+[\\W_]*r+[\\W_]*d+[\\W_]*e+[\\W_]*l+s?)\\b',

  // Chier variations
  '\\b(c+[\\W_]*h+[\\W_]*[i1!]+[\\W_]*e+[\\W_]*r+)\\b',
  '\\b(c+[\\W_]*h+[\\W_]*[i1!]+[\\W_]*a+[\\W_]*n+[\\W_]*t+s?)\\b',

  // Foutre variations
  '\\b(f+[\\W_]*[o0]+[\\W_]*u+[\\W_]*t+[\\W_]*r+[\\W_]*e+)\\b',

  // Enculé variations (enculés plural)
  '\\b(e+[\\W_]*n+[\\W_]*c+[\\W_]*u+[\\W_]*l+[\\W_]*[eé]+s?)\\b',
  '\\b(e+[\\W_]*n+[\\W_]*c+[\\W_]*u+[\\W_]*l+[\\W_]*e+s?)\\b',

  // Connard variations (connards plural)
  '\\b(c+[\\W_]*[o0]+[\\W_]*n+[\\W_]*n+[\\W_]*a+[\\W_]*r+[\\W_]*d+s?)\\b',

  // Fils de pute
  '\\b(f+[\\W_]*[i1!]+[\\W_]*l+[\\W_]*s+[\\W_]*d+[\\W_]*e+[\\W_]*p+[\\W_]*u+[\\W_]*t+[\\W_]*e+s?)\\b',
  '\\b(f+[\\W_]*d+[\\W_]*p+)\\b',

  // Bite variations (bites plural)
  '\\b(b+[\\W_]*[i1!]+[\\W_]*t+[\\W_]*e+s?)\\b',

  // Couille variations (couilles plural)
  '\\b(c+[\\W_]*[o0]+[\\W_]*u+[\\W_]*[i1!]+[\\W_]*l+[\\W_]*l+[\\W_]*e+s?)\\b',

  // Salope variations (salopes plural)
  '\\b(s+[\\W_]*a+[\\W_]*l+[\\W_]*[o0]+[\\W_]*p+[\\W_]*e+s?)\\b',
];

/**
 * French hate speech patterns
 * These detect hate speech, slurs, and discriminatory language
 */
export const HATE_SPEECH_PATTERNS_FR: string[] = [
  // Racial slurs (plurals)
  '\\b(n+[\\W_]*[eè]+[\\W_]*g+[\\W_]*r+[\\W_]*[o0]+s?)\\b',
  '\\b(bougnoules?)\\b',

  // Hate-related terms
  '\\b(h+[\\W_]*a+[\\W_]*[i1!]+[\\W_]*n+[\\W_]*e+s?)\\b',

  // Homophobic slurs (plurals)
  '\\b(p+[\\W_]*[eé]+[\\W_]*d+[\\W_]*[eé]+s?)\\b',
  '\\b(p+[\\W_]*e+[\\W_]*d+[\\W_]*e+s?)\\b',
  '\\b(t+[\\W_]*a+[\\W_]*p+[\\W_]*e+[\\W_]*t+[\\W_]*t+[\\W_]*e+s?)\\b',

  // Xenophobic/Islamophobic terms (plurals)
  '\\b(b+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*[o0]+[\\W_]*t+s?)\\b',
  '\\b(r+[\\W_]*[a@]+[\\W_]*t+[\\W_]*[o0]+[\\W_]*n+s?)\\b',

  // Ableist slurs (plurals)
  '\\b(r+[\\W_]*e+[\\W_]*t+[\\W_]*a+[\\W_]*r+[\\W_]*d+[\\W_]*[eé]+s?)\\b',
  '\\b(r+[\\W_]*e+[\\W_]*t+[\\W_]*a+[\\W_]*r+[\\W_]*d+[\\W_]*e+s?)\\b',
  '\\b(t+[\\W_]*r+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*[o0]+s?)\\b',

  // Antisemitic slurs (plurals)
  '\\b(y+[\\W_]*[o0]+[\\W_]*u+[\\W_]*p+[\\W_]*[i1!]+[\\W_]*n+s?)\\b',

  // Misogynistic terms (plurals)
  '\\b(s+[\\W_]*a+[\\W_]*l+[\\W_]*[o0]+[\\W_]*p+[\\W_]*e+s?)\\b',
  '\\b(c+[\\W_]*h+[\\W_]*[i1!]+[\\W_]*e+[\\W_]*n+[\\W_]*n+[\\W_]*e+s?)\\b',
];

/**
 * French spam patterns
 * These detect spam, advertising, and suspicious content
 */
export const SPAM_PATTERNS_FR: string[] = [
  // Discord invite links (universal)
  '(discord\\.gg/|discordapp\\.com/invite/)',

  // Common spam phrases
  '(nitro\\s+gratuit)',
  '(réclamez\\s+votre)',
  '(cliquez\\s+ici)',
  '(visitez\\s+mon)',
  '(regardez\\s+mon)',

  // Giveaway spam
  '(cadeau\\s+gratuit)',
  '(gagnez\\s+gratuit)',
  '(concours\\s+gratuit)',

  // Suspicious repetition (universal)
  '\\b(\\w+)\\s+\\1\\s+\\1',

  // Advertising
  '(achetez\\s+maintenant)',
  '(offre\\s+limitée)',
  '(temps\\s+limité)',
  '(ne\\s+manquez\\s+pas)',

  // Crypto/scam keywords
  '(cadeau\\s+crypto)',
  '(envoyez\\s+btc)',
  '(doublez\\s+votre)',
];
