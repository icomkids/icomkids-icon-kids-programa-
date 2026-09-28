import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**', '.npm-cache/**', 'dist/**'] },
  { files: ['adhonep/expansion*.js', 'adhonep/admin-expansion.js'], languageOptions: { globals: globals.browser, ecmaVersion: 'latest', sourceType: 'module' }, rules: js.configs.recommended.rules },
  { files: ['tests/expansion*.mjs'], languageOptions: { globals: globals.node, ecmaVersion: 'latest', sourceType: 'module' }, rules: js.configs.recommended.rules },
];
