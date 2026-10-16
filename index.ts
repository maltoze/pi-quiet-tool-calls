/**
 * Quiet tool calls: one line per tool call instead of the default arguments
 * plus an output preview. Works for every tool, including MCP tools.
 *
 * Modes, chosen with `/quiet-tools`:
 * - compact (default): one summary line per call, plus one line for failures.
 * - hidden: nothing is drawn for tool calls at all.
 * Either way, clicking a line or pressing Ctrl+O expands the full arguments and output.
 *
 * The mode is remembered in `<agent dir>/quiet-tool-calls.json`, and
 * `--quiet-tool-calls-hidden` overrides it for one run.
 *
 * Display only: tool calls and results still reach the model unchanged.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ToolRenderers } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

const MODES = ["compact", "hidden"] as const;

type Mode = (typeof MODES)[number];

const DEFAULT_MODE: Mode = "compact";

const HIDDEN_FLAG = "quiet-tool-calls-hidden";

/** Where `/quiet-tools` remembers the mode. Hand-editable. */
const CONFIG_FILE = join(
	process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"),
	"quiet-tool-calls.json",
);

/** Argument keys that make a readable one-line summary, in priority order. */
const BRIEF_KEYS = ["path", "file_path", "command", "pattern", "query", "url", "name"];

/** Characters kept from the summarized argument in the collapsed line. */
const BRIEF_CHARS = 72;

/** Characters kept from the first line of a failed call's output. */
const ERROR_CHARS = 120;

/** The part of a tool result this renderer reads. */
interface ResultPart {
	type: string;
	text?: string;
	mimeType?: string;
}

interface ResultLike {
	content: readonly ResultPart[];
}

function isMode(value: unknown): value is Mode {
	return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

function readStoredMode(): Mode | undefined {
	try {
		const stored = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as { mode?: unknown };
		return isMode(stored.mode) ? stored.mode : undefined;
	} catch {
		// Missing or unreadable config: fall back to the default mode.
		return undefined;
	}
}

function writeStoredMode(mode: Mode): void {
	let stored: Record<string, unknown> = {};
	try {
		stored = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Record<string, unknown>;
	} catch {
		stored = {};
	}
	mkdirSync(dirname(CONFIG_FILE), { recursive: true });
	writeFileSync(CONFIG_FILE, `${JSON.stringify({ ...stored, mode }, null, 2)}\n`);
}

/** Cut to `max` characters, marking the cut with an ellipsis. */
function clamp(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function brief(args: unknown): string {
	if (!args || typeof args !== "object") return "";
	const record = args as Record<string, unknown>;
	const candidates = BRIEF_KEYS.map((key) => record[key]).concat(Object.values(record));
	for (const value of candidates) {
		if (typeof value === "string" && value.trim()) {
			return clamp(value.replace(/\s+/g, " ").trim(), BRIEF_CHARS);
		}
	}
	return "";
}

/** The result as display lines: text verbatim, other parts summarized by kind. */
function resultLines(result: ResultLike): string[] {
	const lines: string[] = [];
	for (const part of result.content) {
		if (part.type !== "text") {
			lines.push(`[${part.type}${part.mimeType ? ` ${part.mimeType}` : ""}]`);
			continue;
		}
		const text = part.text?.trim();
		if (text) lines.push(...text.split("\n"));
	}
	return lines;
}

function renderersFor(mode: Mode, toolName: string): ToolRenderers {
	if (mode === "hidden") {
		// "self" makes pi skip the whole block while the renderers stay empty.
		return {
			renderShell: "self",
			renderCall: () => new Container(),
			renderResult: () => new Container(),
		};
	}

	return {
		renderCall(args, theme, { expanded }) {
			let text = theme.fg("toolTitle", `▸ ${toolName}`);
			const target = brief(args);
			if (target) text += theme.fg("dim", ` ${target}`);
			if (expanded) {
				const pretty = JSON.stringify(args, null, 2)?.trim();
				if (pretty && pretty !== "{}") {
					text += `\n${pretty
						.split("\n")
						.map((line) => theme.fg("dim", `  ${line}`))
						.join("\n")}`;
				}
			}
			return new Text(text, 0, 0);
		},

		// `isError` lives on the render context, not in the options object.
		renderResult(result, { expanded, isPartial }, theme, context?: { isError?: boolean }) {
			const lines = resultLines(result);

			if (expanded && !isPartial && lines.length > 0) {
				return new Text(lines.map((line) => theme.fg("toolOutput", line)).join("\n"), 0, 0);
			}

			// Collapsed: stay quiet unless the call failed.
			if (isPartial || !context?.isError) return new Container();
			const message = lines[0] ?? "failed";
			return new Text(theme.fg("error", `  ✗ ${clamp(message, ERROR_CHARS)}`), 0, 0);
		},
	};
}

export default function (pi: ExtensionAPI) {
	pi.registerFlag(HIDDEN_FLAG, {
		type: "boolean",
		description: `Draw nothing at all for tool calls (same as /quiet-tools hidden)`,
	});

	/** Current mode: the flag wins, then the stored mode, then the default. */
	const currentMode = (): Mode =>
		pi.getFlag(HIDDEN_FLAG) === true ? "hidden" : (readStoredMode() ?? DEFAULT_MODE);

	pi.registerCommand("quiet-tools", {
		description: "Show or set how tool calls are drawn: compact (one line) or hidden (nothing)",
		getArgumentCompletions: (prefix) => {
			const typed = prefix.trim();
			return MODES.filter((mode) => mode.startsWith(typed)).map((mode) => ({
				value: mode,
				label: mode,
				description:
					mode === "hidden" ? "Draw nothing at all for tool calls" : "One summary line per call",
			}));
		},
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const requested = args.trim().toLowerCase();
			const mode = currentMode();

			if (!requested) {
				ctx.ui.notify(`Tool calls are ${mode}. Use /quiet-tools compact | hidden.`);
				return;
			}
			if (!isMode(requested)) {
				ctx.ui.notify(`Unknown mode "${requested}". Use compact or hidden.`, "warning");
				return;
			}
			if (requested === mode) {
				ctx.ui.notify(`Tool calls are already ${requested}.`);
				return;
			}

			writeStoredMode(requested);
			ctx.ui.notify(`Tool calls: ${requested}. Reloading to redraw the transcript.`);
			// A reload re-reads the mode and rebuilds the transcript, so rows that were
			// already drawn switch over too. The replaced context must not be used after this.
			await ctx.reload();
		},
	});

	pi.registerToolRenderer((toolName) => renderersFor(currentMode(), toolName));
}
