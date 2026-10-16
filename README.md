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
pi install npm:pi-quiet-tool-calls
```

To try it for one run without installing:

```bash
pi -e npm:pi-quiet-tool-calls
```

Pin a version, or follow the [repository](https://github.com/maltoze/pi-quiet-tool-calls) instead of a release:

```bash
pi install npm:pi-quiet-tool-calls@0.2.0
pi install git:github.com/maltoze/pi-quiet-tool-calls
```

## Modes

| Mode | What you see |
| --- | --- |
| `compact` (default) | One line per tool call |
| `hidden` | Nothing at all for tool calls |

Switch while running:

```text
/quiet-tools            # report the current mode
/quiet-tools hidden     # draw nothing for tool calls
/quiet-tools compact    # one line per call
```

`/quiet-tools` remembers the choice in `<agent dir>/quiet-tool-calls.json` and reloads pi, so rows that are already on screen redraw with the new mode. Tab completion offers both mode names.

The stored mode applies to every later session. Hand-edit it if you prefer:

```json
{
  "mode": "hidden"
}
```

For a single run, override it from the command line:

```bash
pi --quiet-tool-calls-hidden
```

There is no default keyboard shortcut. Extension shortcuts bind a literal key that users cannot rebind, and `Ctrl+O` is reserved by pi, so `/quiet-tools` is the supported way to switch.

## Behaviour in `compact` mode

| State | What you see |
| --- | --- |
| Collapsed (default) | One line: `▸ <tool> <primary argument>` |
| Expanded — click the line, or press `Ctrl+O` | The arguments as JSON, then the full tool output |
| Failed call | An extra `✗ <first line of the output>` line while collapsed |

- Applies to every tool, including MCP tools and tools that register later.
- The primary argument is the first present of `path`, `file_path`, `command`, `pattern`, `query`, `url`, `name`; it is collapsed to one line and cut at 72 characters. If none of them is present, the first short string argument is used.
- Expanded output is not trimmed: the result is shown as the tool produced it.
- In `hidden` mode expanding has nothing to expand, and result images still render, because pi draws images outside the renderers.

Display only. Tool calls and results reach the model unchanged — this changes nothing about what the model sees, what the tools do, or how many tokens a session costs.

## Development

```bash
npm install     # dev-only, for the host packages' types
npm run check   # tsc --noEmit
pi -e .         # load this directory as a package
```

The host packages `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` are declared as peer dependencies and must not be bundled: pi resolves them at runtime through its extension module aliases.

## License

MIT
