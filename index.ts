/**
 * Quiet tool calls: one line per tool call instead of the default arguments
 * plus an output preview. Works for every tool, including MCP tools.
 *
 * Collapsed (default): one summary line per call, plus one line for failures.
 * Expanded: click the line or press Ctrl+O for the full arguments and output.
 *
 * Display only: tool calls and results still reach the model unchanged.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

/**
 * Draw nothing at all for tool calls. Expanding stops working in this mode, and
 * result images still render, because pi draws images outside the renderers.
 */
const HIDE_ALL = false;

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

export default function (pi: ExtensionAPI) {
	pi.registerToolRenderer((toolName) => {
		if (HIDE_ALL) {
			// "self" makes pi skip the whole block while the renderers stay empty.
			return {
				renderShell: "self" as const,
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
	});
}
