import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "artifacts/**",
      "apps/web/public/engines/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: ts.parser },
    plugins: { "react-hooks": hooks },
    rules: hooks.configs["recommended-latest"].rules,
  },
];
