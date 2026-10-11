import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/pantry.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*", "**"],
              message: "Pantry domain must not import infrastructure.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "fetch",
      ],
    },
  },
  {
    files: ["src/ui.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*storage*", "**/storage*"],
              message: "UI must use the pantry public interface.",
            },
          ],
        },
      ],
    },
  },
);
