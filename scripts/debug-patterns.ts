// Debug script to check pattern loading
import { patternRegistry } from '../src/modules/temp-voice/constants/patterns/patterns-registry.js';

console.log('Testing pattern registry...');

try {
  const patterns = await patternRegistry.getPatterns('en');
  console.log('English patterns loaded:');
  console.log('- Profanity:', patterns.profanity.length);
  console.log('- Hate speech:', patterns.hateSpech.length);
  console.log('- Spam:', patterns.spam.length);
} catch (error) {
  console.error('Error loading patterns:', error);
}
