/**
 * English Language Moderation Patterns
 * Patterns for detecting inappropriate content in English
 */

/**
 * English profanity patterns
 * These patterns detect common profanity with obfuscation attempts
 */
export const PROFANITY_PATTERNS_EN: string[] = [
  // F-word variations (fuck, fucks, fucked, fucker, fucking)
  '\\b(f+[\\W_]*u+[\\W_]*c+[\\W_]*k+[edsring]*)\\b',
  '\\b(f+[\\W_]*[u\\*]+[\\W_]*[c\\*]+[\\W_]*[k\\*]+[edsring]*)\\b',

  // S-word variations (shit, shits, shitty)
  '\\b(s+[\\W_]*h+[\\W_]*i+[\\W_]*t+[sy]?)\\b',
  '\\b(s+[\\W_]*h+[\\W_]*[i1!]+[\\W_]*[t\\*]+[sy]?)\\b',

  // B-word variations (bitch, bitches, bitching)
  '\\b(b+[\\W_]*i+[\\W_]*t+[\\W_]*c+[\\W_]*h+[edsing]*)\\b',
  '\\b(b+[\\W_]*[i1!]+[\\W_]*[t\\*]+[\\W_]*[c\\*]+[\\W_]*[h\\*]+[edsing]*)\\b',

  // A-word variations (ass, asses, asshole, assholes)
  '\\b(a+[\\W_]*s+[\\W_]*s+[es]*)\\b',
  '\\b(a+[\\W_]*s+[\\W_]*s+[\\W_]*h+[\\W_]*o+[\\W_]*l+[\\W_]*e+s?)\\b',

  // D-word variations (damn, damned, dammit)
  '\\b(d+[\\W_]*a+[\\W_]*m+[\\W_]*n+[edsing]*)\\b',
  '\\b(d+[\\W_]*a+[\\W_]*m+[\\W_]*m+[\\W_]*i+[\\W_]*t+)\\b',

  // Hell variations
  '\\b(h+[\\W_]*e+[\\W_]*l+[\\W_]*l+)\\b',

  // C-word variations (cunt, cunts)
  '\\b(c+[\\W_]*u+[\\W_]*n+[\\W_]*t+s?)\\b',
  '\\b(c+[\\W_]*[o0]+[\\W_]*c+[\\W_]*k+s?)\\b',

  // P-word variations (piss, pussy)
  '\\b(p+[\\W_]*[i1!]+[\\W_]*s+[\\W_]*s+[edsing]*)\\b',
  '\\b(p+[\\W_]*u+[\\W_]*s+[\\W_]*s+[\\W_]*y+)\\b',

  // D-word variations (dick, dicks)
  '\\b(d+[\\W_]*i+[\\W_]*c+[\\W_]*k+s?)\\b',
];

/**
 * English hate speech patterns
 * These detect hate speech, slurs, and discriminatory language
 */
export const HATE_SPEECH_PATTERNS_EN: string[] = [
  // Racial slurs (obfuscated, with plurals)
  '\\b(n+[\\W_]*[i1!]+[\\W_]*[g9]+[\\W_]*[g9]+[\\W_]*[ea@]+[\\W_]*r*s?)\\b',
  '\\b(n+[\\W_]*[i1!]+[\\W_]*[g9]+[\\W_]*[g9]+[\\W_]*[a@4]+s?)\\b',

  // Hate-related terms
  '\\b(h+[\\W_]*[a@4]+[\\W_]*t+[\\W_]*e+[rds]*)\\b',
  '\\b(k+[\\W_]*i+[\\W_]*k+[\\W_]*e+s?)\\b',
  '\\b(n+[\\W_]*a+[\\W_]*z+[\\W_]*i+s?)\\b',

  // Homophobic slurs (fag, fags, faggot, faggots)
  '\\b(f+[\\W_]*a+[\\W_]*g+[\\W_]*[g9]*[\\W_]*[o0]*[\\W_]*[t\\*]*s?)\\b',
  '\\b(d+[\\W_]*y+[\\W_]*k+[\\W_]*e+s?)\\b',

  // Ableist slurs (retard, retards, retarded)
  '\\b(r+[\\W_]*e+[\\W_]*t+[\\W_]*a+[\\W_]*r+[\\W_]*d+[edsing]*)\\b',

  // Transphobic slurs (tranny, trannies)
  '\\b(t+[\\W_]*r+[\\W_]*a+[\\W_]*n+[\\W_]*n+[\\W_]*[yi]+[es]*)\\b',

  // Misogynistic terms (whore, whores, slut, sluts)
  '\\b(w+[\\W_]*h+[\\W_]*o+[\\W_]*r+[\\W_]*e+s?)\\b',
  '\\b(s+[\\W_]*l+[\\W_]*u+[\\W_]*t+s?)\\b',
];

/**
 * English spam patterns
 * These detect spam, advertising, and suspicious content
 */
export const SPAM_PATTERNS_EN: string[] = [
  // Discord invite links
  '(discord\\.gg/|discordapp\\.com/invite/)',

  // Common spam phrases
  '(free\\s+nitro)',
  '(claim\\s+your)',
  '(click\\s+here)',
  '(visit\\s+my)',
  '(check\\s+out\\s+my)',

  // Giveaway spam
  '(free\\s+giveaway)',
  '(win\\s+free)',

  // Suspicious repetition
  '\\b(\\w+)\\s+\\1\\s+\\1',

  // Advertising
  '(buy\\s+now)',
  '(limited\\s+time)',
  '(act\\s+now)',
  '(dont\\s+miss)',

  // Crypto/scam keywords
  '(crypto\\s+giveaway)',
  '(send\\s+btc)',
  '(double\\s+your)',
];
