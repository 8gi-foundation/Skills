# React example

`OfficePodzPanel.tsx` shows a realistic embed: the office on one side, host UI on the other.

It is excluded from the default TypeScript project because React is an optional peer dependency and
the core package builds without it. To typecheck and build the React entry point:

```bash
npm install react react-dom @types/react
npm run build:react
```

Three things to get right:

1. **Memoise the adapter.** A new object identity on every render tears the office down and rebuilds
   it. Every agent loses its position and the canvas flickers.
2. **Give the canvas a height.** It fills its container. A container with no height renders nothing,
   which is the single most common integration bug.
3. **Use the ref, not state, for directives.** Sending a directive is a command, not a render.
