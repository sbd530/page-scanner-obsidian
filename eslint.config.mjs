// Obsidian's published rules for plugin code (obsidianmd/eslint-plugin).
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default defineConfig([
  // Written by scripts/vendor-cli.mjs and scripts/build.mjs.
  { ignores: ['vendor/', 'dist/', 'node_modules/'] },
  ...obsidianmd.configs.recommended,
  {
    rules: {
      // Proper nouns, which sentence case keeps as they are.
      'obsidianmd/ui/sentence-case': [
        'warn',
        { brands: ['Page Scanner', 'Chrome Web Store', 'Node.js', 'Local agents'] },
      ],
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'scripts/*.mjs'],
        },
      },
    },
  },
  // The build scripts run under Node, not in Obsidian.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: { 'obsidianmd/no-nodejs-modules': 'off', 'obsidianmd/rule-custom-message': 'off' },
  },
]);
