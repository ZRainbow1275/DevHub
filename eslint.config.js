import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

const noHardcodedInlineZIndexRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow numeric zIndex literals in JSX inline style objects'
    },
    messages: {
      hardcodedInlineZIndex: 'Use a z-index token or imported constant instead of a numeric inline zIndex literal.'
    }
  },
  create(context) {
    function isZIndexKey(key) {
      return (key.type === 'Identifier' && key.name === 'zIndex')
        || (key.type === 'Literal' && key.value === 'zIndex')
    }

    function isNumericLiteral(value) {
      return (value.type === 'Literal' && typeof value.value === 'number')
        || (
          value.type === 'UnaryExpression'
          && value.operator === '-'
          && value.argument.type === 'Literal'
          && typeof value.argument.value === 'number'
        )
    }

    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return
        if (!node.value || node.value.type !== 'JSXExpressionContainer') return
        const expression = node.value.expression
        if (expression.type !== 'ObjectExpression') return

        for (const property of expression.properties) {
          if (property.type !== 'Property') continue
          if (!isZIndexKey(property.key)) continue
          if (!isNumericLiteral(property.value)) continue
          context.report({ node: property.value, messageId: 'hardcodedInlineZIndex' })
        }
      }
    }
  }
}

const localPlugin = {
  rules: {
    'no-hardcoded-inline-z-index': noHardcodedInlineZIndexRule
  }
}

export default tseslint.config(
  {
    ignores: [
      'out/**',
      'release/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      '*.config.js',
      '*.config.ts'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      local: localPlugin,
      react,
      'react-hooks': reactHooks
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'local/no-hardcoded-inline-z-index': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['resources/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly'
      },
      sourceType: 'commonjs'
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off'
    }
  }
)
