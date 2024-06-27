import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            import: importPlugin,
        },
    },
];