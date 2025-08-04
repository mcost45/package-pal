import eslintJs from '@eslint/js';
import pluginStylistic from '@stylistic/eslint-plugin';
import pluginImport from 'eslint-plugin-import';
import pluginJsdoc from 'eslint-plugin-jsdoc';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tsEslint from 'typescript-eslint';

/**
 * @returns {import("typescript-eslint").Config[]}
 */
export default tsEslint.config(
	eslintJs.configs.recommended,
	pluginJsdoc.configs['flat/recommended'],
	pluginImport.flatConfigs.recommended,
	pluginImport.flatConfigs.typescript,
	// eslint-disable-next-line import/no-named-as-default-member
	tsEslint.configs.stylisticTypeChecked,
	// eslint-disable-next-line import/no-named-as-default-member
	tsEslint.configs.strictTypeChecked,
	pluginStylistic.configs.customize({
		indent: 'tab',
		quotes: 'single',
		semi: true,
		braceStyle: '1tbs',
		quoteProps: 'consistent-as-needed',
	}),
	{
		plugins: { 'unused-imports': pluginUnusedImports },
		settings: {
			'import/parsers': { '@typescript-eslint/parser': ['.ts'] },
			'import/resolver': { typescript: true },
		},
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				Bun: true,
			},
			parserOptions: { projectService: true },
		},
		rules: {
			'@stylistic/indent': 'warn',
			'@stylistic/padded-blocks': 'warn',
			'@stylistic/no-mixed-spaces-and-tabs': 'warn',
			'@stylistic/no-trailing-spaces': 'warn',
			'@stylistic/no-multi-spaces': 'warn',
			'@stylistic/no-multiple-empty-lines': 'warn',
			'@stylistic/no-extra-parens': 'warn',
			'@stylistic/comma-dangle': ['warn', 'always-multiline'],
			'@stylistic/eol-last': 'warn',
			'@stylistic/space-in-parens': 'warn',
			'@stylistic/computed-property-spacing': 'warn',
			'@stylistic/space-infix-ops': 'warn',
			'@stylistic/object-curly-spacing': 'warn',
			'@stylistic/semi': 'warn',
			'@stylistic/brace-style': 'warn',
			'@stylistic/block-spacing': 'warn',
			'@stylistic/max-statements-per-line': 'warn',
			'@stylistic/newline-per-chained-call': 'warn',
			'@stylistic/array-element-newline': ['warn', { minItems: 3 }],
			'@stylistic/array-bracket-newline': ['warn', { minItems: 3 }],
			'@stylistic/object-property-newline': 'warn',
			'@stylistic/object-curly-newline': ['warn', { minProperties: 2 }],
			'@stylistic/function-paren-newline': ['warn', { minItems: 3 }],
			'@stylistic/function-call-spacing': 'warn',
			'@stylistic/switch-colon-spacing': 'warn',
			'@stylistic/no-confusing-arrow': 'warn',
			'@stylistic/no-extra-semi': 'warn',
			'@stylistic/semi-spacing': 'warn',
			'@stylistic/implicit-arrow-linebreak': 'warn',
			'@stylistic/comma-spacing': 'warn',
			'@stylistic/array-bracket-spacing': 'warn',
			'@stylistic/arrow-parens': 'warn',
			'no-case-declarations': 'off',
			'no-return-await': 'warn',
			'no-else-return': ['warn', { allowElseIf: false }],
			'no-unused-vars': 'off',
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-returns-description': 'off',
			'jsdoc/require-returns': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-unsafe-function-type': 'off',
			'@typescript-eslint/unbound-method': ['warn', { ignoreStatic: true }],
			'@typescript-eslint/consistent-type-exports': 'warn',
			'@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'separate-type-imports' }],
			'@typescript-eslint/no-import-type-side-effects': 'warn',
			'unused-imports/no-unused-imports': 'warn',
			'unused-imports/no-unused-vars': ['warn', {
				vars: 'all',
				varsIgnorePattern: '^_',
				args: 'none',
			}],
			'import/order': ['warn', {
				'alphabetize': {
					order: 'asc',
					caseInsensitive: true,
				},
				'newlines-between': 'never',
			}],
			'import/no-cycle': 'warn',
			'import/extensions': ['warn', 'ignorePackages'],
		},
	},
);
