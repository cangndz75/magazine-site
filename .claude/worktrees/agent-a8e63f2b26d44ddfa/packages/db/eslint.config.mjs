import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "drizzle/**"],
  },
  ...tseslint.configs.recommended,
);
