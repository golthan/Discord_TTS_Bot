import js from "@eslint/js";

const nodeGlobals = {
  require: "readonly",
  module: "readonly",
  process: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
};

export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**", ".yarn/**"],
  },

  js.configs.recommended,

  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
