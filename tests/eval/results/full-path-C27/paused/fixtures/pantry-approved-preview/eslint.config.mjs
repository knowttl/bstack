import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", ".bstack/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/ui/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\.\\./pantry\\.js$).+",
              message:
                "UI must use the public pantry interface; private storage imports are forbidden.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "UI must not access localStorage directly.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          property: "localStorage",
          message: "UI must not access localStorage directly.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "UI dynamic imports bypass the public interface.",
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: "UI require bypasses the public interface.",
        },
      ],
    },
  },
];
