# Agents

## Toast

Reusable toast component for brief UI feedback.

Usage:
- Import: `import Toast from "./Toast/Toast";`
- Render: `<Toast message="Copied to clipboard" visible={isVisible} />`
- Optional props: `role` ("status" | "alert") and `ariaLive` ("polite" | "assertive") for accessibility.

Notes:
- Position and animation are controlled by `src/components/Toast/Toast.module.css`.
- Visibility is controlled by the `visible` prop; toggle it in state and use a timeout to auto-hide.
