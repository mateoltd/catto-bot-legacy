/**
 * Spanish Language Moderation Patterns
 * Patterns for detecting inappropriate content in Spanish
 */

/**
 * Spanish profanity patterns
 * These patterns detect common Spanish profanity with obfuscation attempts
 */
export const PROFANITY_PATTERNS_ES: string[] = [
  // Mierda variations (mierdas plural)
  '\\b(m+[\\W_]*[i1!]+[\\W_]*e+[\\W_]*r+[\\W_]*d+[\\W_]*a+s?)\\b',

  // Puta/Puto variations (putas, putos plurals)
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*[ao]+s?)\\b',
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*[i1!]+[\\W_]*t+[\\W_]*[ao]+s?)\\b',

  // Carajo variations (carajos plural)
  '\\b(c+[\\W_]*a+[\\W_]*r+[\\W_]*a+[\\W_]*j+[\\W_]*[o0]+s?)\\b',

  // Coño variations (coños plural)
  '\\b(c+[\\W_]*o+[\\W_]*ñ+[\\W_]*[o0]+s?)\\b',
  '\\b(c+[\\W_]*[o0]+[\\W_]*n+[\\W_]*[o0]+s?)\\b',

  // Joder variations
  '\\b(j+[\\W_]*[o0]+[\\W_]*d+[\\W_]*e+[\\W_]*r+)\\b',

  // Cabrón variations (cabrones plural)
  '\\b(c+[\\W_]*a+[\\W_]*b+[\\W_]*r+[\\W_]*[oó]+[\\W_]*n+[es]*)\\b',
  '\\b(c+[\\W_]*a+[\\W_]*b+[\\W_]*r+[\\W_]*[o0]+[\\W_]*n+[es]*)\\b',

  // Pendejo variations (pendejos plural)
  '\\b(p+[\\W_]*e+[\\W_]*n+[\\W_]*d+[\\W_]*e+[\\W_]*j+[\\W_]*[o0]+s?)\\b',

  // Hijo de puta variations
  '\\b(h+[\\W_]*[i1!]+[\\W_]*j+[\\W_]*[o0]+[\\W_]*d+[\\W_]*e+[\\W_]*p+[\\W_]*u+[\\W_]*t+[\\W_]*a+s?)\\b',
  '\\b(h+[\\W_]*d+[\\W_]*p+)\\b',

  // Chingar variations (chingas, chingado, chingada)
  '\\b(c+[\\W_]*h+[\\W_]*[i1!]+[\\W_]*n+[\\W_]*g+[\\W_]*[ao]+[ds]?[ao]?s?)\\b',

  // Verga variations (vergas plural)
  '\\b(v+[\\W_]*e+[\\W_]*r+[\\W_]*g+[\\W_]*a+s?)\\b',

  // Culero variations (culeros plural)
  '\\b(c+[\\W_]*u+[\\W_]*l+[\\W_]*e+[\\W_]*r+[\\W_]*[o0]+s?)\\b',

  // Mamón variations (mamones plural)
  '\\b(m+[\\W_]*a+[\\W_]*m+[\\W_]*[oó]+[\\W_]*n+[es]*)\\b',
  '\\b(m+[\\W_]*a+[\\W_]*m+[\\W_]*[o0]+[\\W_]*n+[es]*)\\b',

  // Marica variations (maricas plural)
  '\\b(m+[\\W_]*a+[\\W_]*r+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*[ao]+s?)\\b',
];

/**
 * Spanish hate speech patterns
 * These detect hate speech, slurs, and discriminatory language
 */
export const HATE_SPEECH_PATTERNS_ES: string[] = [
  // Racial slurs (negros/negras plural)
  '\\b(n+[\\W_]*e+[\\W_]*g+[\\W_]*r+[\\W_]*[o0a]+s?)\\b',

  // Hate-related terms
  '\\b([o0]+[\\W_]*d+[\\W_]*[i1!]+[\\W_]*[o0]+s?)\\b',

  // Homophobic slurs (maricones plural)
  '\\b(m+[\\W_]*a+[\\W_]*r+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*[ao]+[\\W_]*n+[es]*)\\b',
  '\\b(m+[\\W_]*a+[\\W_]*r+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*[o0]+s?)\\b',
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*[o0]+s?)\\b',

  // Xenophobic terms (sudacas plural)
  '\\b(s+[\\W_]*u+[\\W_]*d+[\\W_]*a+[\\W_]*c+[\\W_]*a+s?)\\b',

  // Ableist slurs (retrasados/mongólicos plural)
  '\\b(r+[\\W_]*e+[\\W_]*t+[\\W_]*r+[\\W_]*a+[\\W_]*s+[\\W_]*a+[\\W_]*d+[\\W_]*[o0]+s?)\\b',
  '\\b(m+[\\W_]*[o0]+[\\W_]*n+[\\W_]*g+[\\W_]*[o0]+[\\W_]*l+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*[o0]+s?)\\b',

  // Misogynistic terms (zorras, perras plural)
  '\\b(z+[\\W_]*[o0]+[\\W_]*r+[\\W_]*r+[\\W_]*a+s?)\\b',
  '\\b(p+[\\W_]*e+[\\W_]*r+[\\W_]*r+[\\W_]*a+s?)\\b',
];

/**
 * Spanish spam patterns
 * These detect spam, advertising, and suspicious content
 */
export const SPAM_PATTERNS_ES: string[] = [
  // Discord invite links (universal)
  '(discord\\.gg/|discordapp\\.com/invite/)',

  // Common spam phrases
  '(nitro\\s+gratis)',
  '(reclama\\s+tu)',
  '(haz\\s+clic)',
  '(visita\\s+mi)',
  '(mira\\s+mi)',

  // Giveaway spam
  '(sorteo\\s+gratis)',
  '(gana\\s+gratis)',
  '(regalo\\s+gratis)',

  // Suspicious repetition (universal)
  '\\b(\\w+)\\s+\\1\\s+\\1',

  // Advertising
  '(compra\\s+ahora)',
  '(oferta\\s+limitada)',
  '(tiempo\\s+limitado)',
  '(no\\s+te\\s+pierdas)',

  // Crypto/scam keywords
  '(sorteo\\s+crypto)',
  '(envia\\s+btc)',
  '(duplica\\s+tu)',
];
