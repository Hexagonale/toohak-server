module.exports = {
    root: true,
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'airbnb/base', 'airbnb-typescript/base'],
    plugins: ['@typescript-eslint', 'simple-import-sort'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
    },
    rules: {
        '@typescript-eslint/indent': ['error', 4],
        'import/prefer-default-export': 'off',
        'class-methods-use-this': 'off',
        'import/no-cycle': 'off',
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
        'arrow-body-style': 'off',
        'max-len': ['error', 120],
        '@typescript-eslint/comma-dangle': 'off',
        '@typescript-eslint/lines-between-class-members': 'off',
        '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors'] }],
        '@typescript-eslint/no-shadow': 'off',
        'default-case': 'off',
        // TypeScript's noImplicitReturns handles this
        'consistent-return': 'off',
        'object-curly-newline': 'off',
        'no-restricted-syntax': 'off',
    },
};
