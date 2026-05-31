/**
 * LaTeX Render Extension for oh-my-pi
 *
 * Converts LaTeX math expressions to Unicode in terminal output.
 * Uses the Gemini CLI's battle-tested converter (Apache-2.0).
 *
 * Registers:
 * - `/latex <expr>`        — Render a LaTeX expression inline
 * - `render_latex` tool    — Let the LLM render LaTeX to Unicode
 * - `tool_result` hook     — Auto-convert LaTeX in tool outputs
 *
 * Install: drop this directory into ~/.omp/agent/extensions/ or
 *          add to settings.json extensions array.
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { convertLatexToUnicode, renderLatexCodeBlocks } from "./latex-to-unicode";

export default function latexRenderExtension(pi: ExtensionAPI): void {
	pi.setLabel("LaTeX Renderer");

	// ======================================================================
	// 0. System prompt — instruct the model to use $...$ for math
	// ======================================================================
	pi.registerSystemPromptSection(
		"latex-rendering",
		[
			"## Math Rendering",
			"",
			"When writing mathematical expressions in your responses, ALWAYS wrap them in `$...$` delimiters.",
			"This ensures they render as Unicode in the terminal.",
			"",
			"Examples:",
			"- Inline: `$E = mc^2$` → E = mc²",
			"- Fractions: `$\\frac{a}{b}$` → (a)/(b)",
			"- Greek: `$\\alpha + \\beta$` → α + β",
			"- Subscripts: `$x_0 + x_1$` → x₀ + x₁",
			"- Display: `$$\\sum_{i=0}^{n} x_i$$` → ∑ᵢ₌₀ⁿ xᵢ",
			"",
			"Rules:",
			"- Use `$...$` for inline math, `$$...$$` for display math",
			"- Always use LaTeX syntax inside delimiters (e.g. `\\frac{a}{b}`, not `a/b`)",
			"- Do NOT leave math expressions unwrapped — plain `x^2` won't render properly",
			"- For fenced code blocks, use ` ```latex ` language tag",
		].join("\n"),
	);
	// ======================================================================
	// 1. /latex slash command
	// ======================================================================
	pi.registerCommand("latex", {
		description: "Render a LaTeX math expression to Unicode",
		handler: async (args: string, ctx) => {
			const expr = args.trim();
			if (!expr) {
				ctx.ui.notify("Usage: /latex <expression>\n  e.g. /latex \\frac{1}{2} + \\alpha^2", "info");
				return;
			}

			const rendered = convertLatexToUnicode(expr);
			pi.sendMessage(
				{
					customType: "latex-render",
					content: [{ type: "text", text: rendered }],
					display: true,
					details: { source: expr },
				},
				{ triggerTurn: false },
			);
		},
	});

	// ======================================================================
	// 2. render_latex tool — lets the LLM render LaTeX on demand
	// ======================================================================
	pi.registerTool({
		name: "render_latex",
		label: "Render LaTeX",
		description:
			"Convert a LaTeX math expression to Unicode text for terminal display. " +
			"Use this when you need to show mathematical expressions in a readable format. " +
			"Supports Greek letters, operators, fractions, sub/superscripts, and more.",
		parameters: {
			type: "object",
			properties: {
				expression: {
					type: "string",
					description: "The LaTeX math expression to render (e.g. '\\frac{a}{b}', '\\alpha + \\beta')",
				},
			},
			required: ["expression"],
		},
		async execute(_id, params) {
			const expr = String(params.expression ?? "");
			if (!expr) {
				return { content: [{ type: "text", text: "Error: empty expression" }] };
			}
			const rendered = convertLatexToUnicode(expr);
			return {
				content: [{ type: "text", text: rendered }],
				details: { source: expr, rendered },
			};
		},
	});

	// ======================================================================
	// 3. tool_result hook — auto-convert LaTeX in tool outputs
	// ======================================================================
	pi.on("tool_result", async (event, _ctx) => {
		// Only process text content blocks
		if (!event.output?.content || !Array.isArray(event.output.content)) {
			return;
		}

		let modified = false;
		for (const block of event.output.content) {
			if (block.type !== "text" || typeof block.text !== "string") continue;

			const original = block.text;

			// Skip if no LaTeX markers at all
			if (original.indexOf("\\") === -1 && original.indexOf("$") === -1) continue;

			// First: render fenced ```latex code blocks
			let converted = renderLatexCodeBlocks(original);

			// Then: convert inline $...$ and prose LaTeX
			converted = convertLatexToUnicode(converted);

			if (converted !== original) {
				block.text = converted;
				modified = true;
			}
		}

		// Returning undefined means "no modification" — we only return
		// when we actually changed something.
		if (modified) {
			return { output: event.output };
		}
	});
}
