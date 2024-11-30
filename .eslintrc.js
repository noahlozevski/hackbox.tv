module.exports = {
  env: {
    node: true,
    es6: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "next",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "prettier"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    // Custom rules if needed
  },
};
