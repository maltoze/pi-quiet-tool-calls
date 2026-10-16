# pi-quiet-tool-calls

A [pi](https://pi.dev) extension that collapses every tool call in the transcript to a single line.

**Before**

```text
read
  path: src/app/page.tsx
  offset: 1
  limit: 80
Path: /Users/you/project/src/app/page.tsx
   1 | import { headers } from "next/headers";
   2 | ...
 ... (78 more lines, ctrl+o to expand)
```

**After**

```text
▸ read src/app/page.tsx
```

Failures stay visible while collapsed:

```text
▸ bash npm test
  ✗ exit code 1
```

## Install

```bash
pi install git:github.com/maltoze/pi-quiet-tool-calls

# or try it for one run, without installing
pi -e git:github.com/maltoze/pi-quiet-tool-calls
```

## Behaviour

| State | What you see |
| --- | --- |
| Collapsed (default) | One line: `▸ <tool> <primary argument>` |
| Expanded — click the line, or press `Ctrl+O` | The arguments as JSON, then the full tool output |
| Failed call | An extra `✗ <first line of the output>` line while collapsed |

- Applies to every tool, including MCP tools and tools that register later.
- The primary argument is the first present of `path`, `file_path`, `command`, `pattern`, `query`, `url`, `name`; it is collapsed to one line and cut at 72 characters. If none of them is present, the first short string argument is used.
- Expanded output is not trimmed: the result is shown as the tool produced it.
- Display only. Tool calls and results reach the model unchanged — this changes nothing about what the model sees, what the tools do, or how many tokens a session costs.

## Full hide

Set `HIDE_ALL` to `true` in `index.ts` to draw nothing at all for tool calls. Expanding stops working in that mode, and result images still render, because pi draws images outside the renderers.

## Development

```bash
npm install     # dev-only, for the host packages' types
npm run check   # tsc --noEmit
pi -e .         # load this directory as a package
```

The host packages `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` are declared as peer dependencies and must not be bundled: pi resolves them at runtime through its extension module aliases.

## License

MIT
