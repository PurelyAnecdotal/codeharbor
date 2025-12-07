import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { fileURLToPath } from 'bun';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

// Derived from https://github.com/sveltejs/eslint-plugin-svelte/blob/main/README.md#typescript-project
export default defineConfig([
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...tseslint.configs.strict /*TypeChecked*/,
	...tseslint.configs.stylistic /*TypeChecked*/,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				parser: tseslint.parser
				// projectService: true
			}
		},
		rules: {
			'no-undef': 'off',
			'no-duplicate-imports': 'error',
			eqeqeq: 'error'
			// '@typescript-eslint/promise-function-async': 'error',
			// '@typescript-eslint/strict-boolean-expressions': 'error'
		}
	},
	{
		name: 'svelte',
		files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				// projectService: false,
				extraFileExtensions: ['.svelte'],
				svelteConfig
			}
		}
		// extends: [tseslint.configs.disableTypeChecked] // Type-checked rules are broken in .svelte files https://github.com/sveltejs/svelte/issues/16264
	}
]);
