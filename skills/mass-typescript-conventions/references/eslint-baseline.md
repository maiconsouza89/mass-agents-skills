# ESLint baseline

Flat config (`eslint.config.js`) for TypeScript projects at Mass Solutions. Apply it when a project has no lint config or when it is weaker than this.

```js
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'import/no-cycle': 'error',
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './src/domain', from: './src/infra', message: 'domain must not depend on infra' },
          { target: './src/domain', from: './src/ui', message: 'domain must not depend on ui' },
          { target: './src/ui', from: './src/infra', message: 'ui talks to infra through application services' },
        ],
      }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
)
```

## Rule intent

| Rule | Why it exists |
|---|---|
| `no-explicit-any` | `any` silently disables checking for everything it touches. |
| `no-non-null-assertion` | `!` documents hope, not knowledge. |
| `explicit-module-boundary-types` | Exported signatures are contracts; inference hides accidental changes. |
| `switch-exhaustiveness-check` | Adding a union member must fail compilation where it is not handled. |
| `no-floating-promises` | An unawaited promise is an unhandled rejection waiting to happen. |
| `import/no-restricted-paths` | Enforces the domain / application / infra / ui layering mechanically. |

## Adjusting per project

- Allow `console` in CLIs by overriding `no-console` for the `bin/` folder.
- Test files may relax non-null assertions; nothing else.
- Any other relaxation needs a comment above the rule with the reason and an owner.
