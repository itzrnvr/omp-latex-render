/**
 * Tests for the LaTeX-to-Unicode converter.
 * Run with: bun run test.ts
 *
 * Adapted from Gemini CLI's test suite (Apache-2.0).
 */

import { convertLatexToUnicode, renderLatexCodeBlocks } from "./latex-to-unicode";

let passed = 0;
let failed = 0;

function assert(name: string, actual: string, expected: string) {
	if (actual === expected) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name}`);
		console.error(`    expected: ${JSON.stringify(expected)}`);
		console.error(`    actual:   ${JSON.stringify(actual)}`);
	}
}

function section(name: string) {
	console.log(`\n${name}`);
}

// ============================================================================
// Tests
// ============================================================================

section("Fast path");
assert("empty string", convertLatexToUnicode(""), "");
assert("no backslash or dollar", convertLatexToUnicode("hello world"), "hello world");

section("Issue #25656 examples (Gemini CLI)");
assert(
	"set of processes",
	convertLatexToUnicode('A set of processes $\\{P_0, P_1, \\dots, P_n\\}$ exists'),
	"A set of processes {P₀, P₁, …, Pₙ} exists",
);
assert(
	"deadlock arrow",
	convertLatexToUnicode("If the graph contains no cycles $\\to$ No Deadlock."),
	"If the graph contains no cycles → No Deadlock.",
);

section("Math delimiters");
assert("inline math with backslash", convertLatexToUnicode("see $\\alpha$ here"), "see α here");
assert("inline math single var", convertLatexToUnicode("let $x$ be a value"), "let x be a value");
assert("display math", convertLatexToUnicode("$$\\alpha + \\beta$$"), "α + β");
assert("currency untouched", convertLatexToUnicode("It costs $5.99 total"), "It costs $5.99 total");
assert("shell vars untouched", convertLatexToUnicode("echo $USER $HOME"), "echo $USER $HOME");

section("Greek letters");
assert("lowercase", convertLatexToUnicode("\\alpha \\beta \\gamma"), "α β γ");
assert("uppercase", convertLatexToUnicode("\\Omega \\Delta"), "Ω Δ");
assert("prefix not mangled", convertLatexToUnicode("\\alphabet"), "\\alphabet");

section("Named commands");
assert("arrows", convertLatexToUnicode("\\to \\rightarrow \\Rightarrow"), "→ → ⇒");
assert("relations", convertLatexToUnicode("\\leq \\geq \\neq \\approx"), "≤ ≥ ≠ ≈");
assert("set theory", convertLatexToUnicode("\\in \\notin \\cup \\cap"), "∈ ∉ ∪ ∩");
assert("logic", convertLatexToUnicode("\\forall x \\exists y"), "∀ x ∃ y");
assert("large operators", convertLatexToUnicode("\\sum \\prod \\int"), "∑ ∏ ∫");
assert("ellipses", convertLatexToUnicode("a, b, \\dots, z"), "a, b, …, z");
assert("infty", convertLatexToUnicode("\\infty"), "∞");
assert("unknown command untouched", convertLatexToUnicode("\\thisIsNotReal"), "\\thisIsNotReal");

section("Text formatting");
assert("textbf → bold", convertLatexToUnicode("\\textbf{hello}"), "**hello**");
assert("textit → italic", convertLatexToUnicode("\\textit{hello}"), "*hello*");
assert("text stripped", convertLatexToUnicode("\\text{plain}"), "plain");
assert("mathrm stripped", convertLatexToUnicode("\\mathrm{foo}"), "foo");

section("Fractions and roots");
assert("frac", convertLatexToUnicode("\\frac{a}{b}"), "(a)/(b)");
assert("sqrt", convertLatexToUnicode("\\sqrt{x}"), "√(x)");
assert("sqrt with index", convertLatexToUnicode("\\sqrt[3]{x}"), "3√(x)");
assert("frac with greek", convertLatexToUnicode("\\frac{\\alpha}{\\beta}"), "(α)/(β)");

section("Subscripts and superscripts");
assert("digit subscripts in math", convertLatexToUnicode("$x_0 + x_1 + x_2$"), "x₀ + x₁ + x₂");
assert("digit superscripts in math", convertLatexToUnicode("$E = mc^2$"), "E = mc²");
assert("letter subscripts in math", convertLatexToUnicode("$P_n$ and $x_i$"), "Pₙ and xᵢ");
assert("braced digit subscripts", convertLatexToUnicode("$x_{12}$"), "x₁₂");
assert("unmapped subscript left alone", convertLatexToUnicode("$x_{abq}$"), "x_{abq}");
assert("identifiers preserved", convertLatexToUnicode("the file_name variable"), "the file_name variable");
assert("bare x_0 outside math untouched", convertLatexToUnicode("x_0 is fine"), "x_0 is fine");

section("Protection of non-LaTeX content");
assert("Windows paths", convertLatexToUnicode("C:\\Users\\foo\\bar"), "C:\\Users\\foo\\bar");
assert("UNC paths", convertLatexToUnicode("\\\\server\\share\\file"), "\\\\server\\share\\file");
assert("regex escapes", convertLatexToUnicode("\\d+\\w*"), "\\d+\\w*");

section("Combined scenarios");
assert(
	"complex math in prose",
	convertLatexToUnicode("The complexity is $O(n \\log n)$ for sorting $n$ elements."),
	"The complexity is O(n log n) for sorting n elements.",
);
assert(
	"multiple constructs",
	convertLatexToUnicode("Let $\\alpha \\in \\mathbb{R}$ and $\\beta \\geq 0$."),
	"Let α ∈ R and β ≥ 0.",
);

section("Fenced code blocks");
assert(
	"latex code block",
	renderLatexCodeBlocks("```latex\n\\alpha + \\beta\n```"),
	"α + β\n",
);
assert(
	"tex code block",
	renderLatexCodeBlocks("```tex\n\\frac{a}{b}\n```"),
	"(a)/(b)\n",
);

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	process.exit(1);
}
