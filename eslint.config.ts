import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import * as drizzle from 'eslint-plugin-drizzle';
import neverthrow from 'eslint-plugin-neverthrow';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.strict,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	...drizzle.configs.recommended,
	{
		plugins: { neverthrow },
		rules: {
			'neverthrow/must-use-result': 'error'
		}
	},
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: { 'no-undef': 'off' }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
