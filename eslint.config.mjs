import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";
import noOnlyTests from "eslint-plugin-no-only-tests";

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
        },
        plugins: {
            noOnlyTests,
        },
    },
    prettier,
];
