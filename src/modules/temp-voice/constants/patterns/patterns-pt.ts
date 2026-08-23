/**
 * Portuguese Language Moderation Patterns
 * Patterns for detecting inappropriate content in Portuguese
 */

/**
 * Portuguese profanity patterns
 * These patterns detect common Portuguese profanity with obfuscation attempts
 */
export const PROFANITY_PATTERNS_PT: string[] = [
  // Merda variations (merdas plural)
  '\\b(m+[\\W_]*e+[\\W_]*r+[\\W_]*d+[\\W_]*a+s?)\\b',

  // Puta/Puto variations (putas/putos plural)
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*[ao]+s?)\\b',
  '\\b(p+[\\W_]*u+[\\W_]*t+[\\W_]*[i1!]+[\\W_]*n+[\\W_]*h+[\\W_]*[ao]+s?)\\b',

  // Caralho variations (caralhos plural)
  '\\b(c+[\\W_]*a+[\\W_]*r+[\\W_]*a+[\\W_]*l+[\\W_]*h+[\\W_]*[o0]+s?)\\b',

  // Foder variations (fodidos plural)
  '\\b(f+[\\W_]*[o0]+[\\W_]*d+[\\W_]*e+[\\W_]*r+)\\b',
  '\\b(f+[\\W_]*[o0]+[\\W_]*d+[\\W_]*[i1!]+[\\W_]*d+[\\W_]*[o0]+s?)\\b',

  // Cu variations
  '\\b(c+[\\W_]*u+)\\b',

  // Cú variations
  '\\b(c+[\\W_]*ú+)\\b',

  // Cacete variations (cacetes plural)
  '\\b(c+[\\W_]*a+[\\W_]*c+[\\W_]*e+[\\W_]*t+[\\W_]*e+s?)\\b',

  // Porra variations (porras plural)
  '\\b(p+[\\W_]*[o0]+[\\W_]*r+[\\W_]*r+[\\W_]*a+s?)\\b',

  // Filho da puta variations
  '\\b(f+[\\W_]*[i1!]+[\\W_]*l+[\\W_]*h+[\\W_]*[o0]+[\\W_]*d+[\\W_]*a+[\\W_]*p+[\\W_]*u+[\\W_]*t+[\\W_]*a+s?)\\b',
  '\\b(f+[\\W_]*d+[\\W_]*p+)\\b',

  // Vai se foder
  '\\b(v+[\\W_]*a+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*e+[\\W_]*f+[\\W_]*[o0]+[\\W_]*d+[\\W_]*e+[\\W_]*r+)\\b',

  // Bosta variations (bostas plural)
  '\\b(b+[\\W_]*[o0]+[\\W_]*s+[\\W_]*t+[\\W_]*a+s?)\\b',

  // Buceta variations (bucetas plural)
  '\\b(b+[\\W_]*u+[\\W_]*c+[\\W_]*e+[\\W_]*t+[\\W_]*a+s?)\\b',

  // Viado variations (viados plural)
  '\\b(v+[\\W_]*[i1!]+[\\W_]*a+[\\W_]*d+[\\W_]*[o0]+s?)\\b',

  // Arrombado variations (arrombados plural)
  '\\b(a+[\\W_]*r+[\\W_]*r+[\\W_]*[o0]+[\\W_]*m+[\\W_]*b+[\\W_]*a+[\\W_]*d+[\\W_]*[o0]+s?)\\b',
];

/**
 * Portuguese hate speech patterns
 * These detect hate speech, slurs, and discriminatory language
 */
export const HATE_SPEECH_PATTERNS_PT: string[] = [
  // Racial slurs (plurals)
  '\\b(n+[\\W_]*e+[\\W_]*g+[\\W_]*[uo]+s?)\\b',
  '\\b(n+[\\W_]*e+[\\W_]*g+[\\W_]*r+[\\W_]*[oa]+s?)\\b',
  '\\b(m+[\\W_]*a+[\\W_]*c+[\\W_]*a+[\\W_]*c+[\\W_]*[o0]+s?)\\b',

  // Hate-related terms
  '\\b([o0]+[\\W_]*d+[\\W_]*[i1!]+[\\W_]*[o0]+s?)\\b',

  // Homophobic slurs (plurals)
  '\\b(v+[\\W_]*[i1!]+[\\W_]*a+[\\W_]*d+[\\W_]*[o0]+s?)\\b',
  '\\b(b+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*h+[\\W_]*a+s?)\\b',
  '\\b(s+[\\W_]*a+[\\W_]*p+[\\W_]*a+[\\W_]*t+[\\W_]*ã+[\\W_]*[o0]+)\\b',
  '\\b(s+[\\W_]*a+[\\W_]*p+[\\W_]*a+[\\W_]*t+[\\W_]*a+[\\W_]*[o0]+)\\b',

  // Xenophobic terms (plurals)
  '\\b(g+[\\W_]*a+[\\W_]*l+[\\W_]*e+[\\W_]*g+[\\W_]*[o0]+s?)\\b',

  // Ableist slurs (plurals)
  '\\b(r+[\\W_]*e+[\\W_]*t+[\\W_]*a+[\\W_]*r+[\\W_]*d+[\\W_]*a+[\\W_]*d+[\\W_]*[o0]+s?)\\b',
  '\\b(m+[\\W_]*[o0]+[\\W_]*n+[\\W_]*g+[\\W_]*[o0]+[\\W_]*l+[\\W_]*[o0]+[\\W_]*[i1!]+[\\W_]*d+[\\W_]*e+s?)\\b',
  '\\b(d+[\\W_]*e+[\\W_]*f+[\\W_]*[i1!]+[\\W_]*c+[\\W_]*[i1!]+[\\W_]*e+[\\W_]*n+[\\W_]*t+[\\W_]*e+s?)\\b',

  // Misogynistic terms (plurals)
  '\\b(v+[\\W_]*a+[\\W_]*d+[\\W_]*[i1!]+[\\W_]*a+s?)\\b',
  '\\b(r+[\\W_]*a+[\\W_]*m+[\\W_]*e+[\\W_]*[i1!]+[\\W_]*r+[\\W_]*a+s?)\\b',
  '\\b(p+[\\W_]*[i1!]+[\\W_]*r+[\\W_]*a+[\\W_]*n+[\\W_]*h+[\\W_]*a+s?)\\b',
];

/**
 * Portuguese spam patterns
 * These detect spam, advertising, and suspicious content
 */
export const SPAM_PATTERNS_PT: string[] = [
  // Discord invite links (universal)
  '(discord\\.gg/|discordapp\\.com/invite/)',

  // Common spam phrases
  '(nitro\\s+grátis)',
  '(nitro\\s+gratis)',
  '(reivindique\\s+seu)',
  '(clique\\s+aqui)',
  '(visite\\s+meu)',
  '(veja\\s+meu)',

  // Giveaway spam
  '(sorteio\\s+grátis)',
  '(sorteio\\s+gratis)',
  '(ganhe\\s+grátis)',
  '(ganhe\\s+gratis)',

  // Suspicious repetition (universal)
  '\\b(\\w+)\\s+\\1\\s+\\1',

  // Advertising
  '(compre\\s+agora)',
  '(oferta\\s+limitada)',
  '(tempo\\s+limitado)',
  '(não\\s+perca)',
  '(nao\\s+perca)',

  // Crypto/scam keywords
  '(sorteio\\s+crypto)',
  '(envie\\s+btc)',
  '(duplique\\s+seu)',
];
