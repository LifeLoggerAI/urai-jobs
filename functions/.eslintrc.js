module.exports = {
  root: true, env: { es6: true, node: true },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "google"],
  parser: "@typescript-eslint/parser",
  parserOptions: { project: ["tsconfig.json"], sourceType: "module" },
  ignorePatterns: [ "/lib/**/*" ],
  plugins: ["@typescript-eslint"],
  rules: {
    "quotes": ["error", "double"], "indent": ["error", 2], "object-curly-spacing": ["error", "always"],
    "max-len": ["error", { "code": 120 }], "@typescript-eslint/no-non-null-assertion": "off",
    "require-jsdoc": "off", "valid-jsdoc": "off", "new-cap": "off"
  },
};
