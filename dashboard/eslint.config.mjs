import next from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      '__tests__/**',
      'node_modules/**',
      'dist/**',
      'public/vendor/**',
    ],
  },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
