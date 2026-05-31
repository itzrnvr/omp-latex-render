/**
 * LaTeX-to-Unicode converter for terminal display.
 *
 * Adapted from Google Gemini CLI (Apache-2.0):
 * https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/utils/latexToUnicode.ts
 *
 * Converts common LaTeX-style syntax in model output into terminal-friendly
 * Unicode. Conservative and lossy: handles common cases, leaves anything
 * unrecognised untouched so Windows paths, regex escapes, etc. survive.
 */

// Greek letters, lower and upper case, plus common "var" variants.
const GREEK_LETTERS: Readonly<Record<string, string>> = Object.freeze({
	alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
	zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
	lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο',
	pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
	phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
	Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε',
	Zeta: 'Ζ', Eta: 'Η', Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ',
	Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν', Xi: 'Ξ', Omicron: 'Ο',
	Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ', Upsilon: 'Υ',
	Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
	varepsilon: 'ε', vartheta: 'ϑ', varphi: 'φ', varrho: 'ϱ',
	varsigma: 'ς', varpi: 'ϖ',
});

// Named LaTeX commands → Unicode. Covers arrows, relations, set theory,
// logic, large operators, and common decorations.
const LATEX_COMMANDS: Readonly<Record<string, string>> = Object.freeze({
	// Arrows
	to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐',
	leftrightarrow: '↔', Leftrightarrow: '⇔', mapsto: '↦',
	longrightarrow: '⟶', longleftarrow: '⟵', longleftrightarrow: '⟷',
	uparrow: '↑', downarrow: '↓', Uparrow: '⇑', Downarrow: '⇓',
	hookrightarrow: '↪', hookleftarrow: '↩',
	// Ellipses
	dots: '…', ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
	// Arithmetic / comparison
	times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', ast: '∗',
	leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
	ll: '≪', gg: '≫', approx: '≈', equiv: '≡', sim: '∼',
	simeq: '≃', cong: '≅', propto: '∝',
	// Set theory
	in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃',
	subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩',
	setminus: '∖', emptyset: '∅', varnothing: '∅',
	// Logic
	forall: '∀', exists: '∃', nexists: '∄', neg: '¬', lnot: '¬',
	land: '∧', wedge: '∧', lor: '∨', vee: '∨',
	oplus: '⊕', otimes: '⊗', implies: '⟹', iff: '⟺',
	// Large operators
	sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬',
	iiint: '∭', oint: '∮',
	// Calculus
	partial: '∂', nabla: '∇', infty: '∞',
	// Misc letters / constants
	ell: 'ℓ', hbar: 'ℏ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', beth: 'ℶ',
	// Brackets / delimiters
	lbrace: '{', rbrace: '}', lbrack: '[', rbrack: ']',
	langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉',
	lfloor: '⌊', rfloor: '⌋',
	// Geometry / misc
	perp: '⊥', parallel: '∥', angle: '∠', triangle: '△', square: '□',
	circ: '∘', bullet: '•', star: '⋆', prime: '′',
	dag: '†', ddag: '‡', therefore: '∴', because: '∵', top: '⊤', bot: '⊥',
	// Operator names — render as upright text (lowercase word).
	log: 'log', ln: 'ln', lg: 'lg', exp: 'exp',
	sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
	arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
	sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
	max: 'max', min: 'min', sup: 'sup', inf: 'inf',
	lim: 'lim', limsup: 'lim sup', liminf: 'lim inf',
	arg: 'arg', det: 'det', dim: 'dim', ker: 'ker', gcd: 'gcd',
	deg: 'deg', hom: 'hom', mod: 'mod', bmod: 'mod', pmod: 'mod',
	// Whitespace
	quad: '  ', qquad: '    ',
	',': ' ', ';': ' ', ':': ' ', '!': '',
});

const SUBSCRIPT_MAP: Readonly<Record<string, string>> = Object.freeze({
	'0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
	'5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
	'+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
	a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ',
	l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ',
	s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
});

const SUPERSCRIPT_MAP: Readonly<Record<string, string>> = Object.freeze({
	'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
	'5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
	'+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
	a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ',
	g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ',
	m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ',
	t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
});

// ---------------------------------------------------------------------------
// Conversion stages
// ---------------------------------------------------------------------------

function stripMathDelimiters(text: string): string {
	// Display math first
	let out = text.replace(/\$\$([^$]+)\$\$/g, (_, inner: string) =>
		applyMathModeConversions(inner),
	);
	// Inline math: lazy, single-line
	out = out.replace(/\$([^$\n]+?)\$/g, (match, inner: string) => {
		const hasLatexMarkers = /\\[A-Za-z]|[\\_^]/.test(inner);
		const isSingleVariable = /^\s*[A-Za-z]\s*$/.test(inner);
		if (hasLatexMarkers || isSingleVariable) {
			return applyMathModeConversions(inner);
		}
		return match;
	});
	return out;
}

function convertTextFormatting(text: string): string {
	let out = text;
	out = out.replace(/\\(?:textbf|mathbf)\{([^{}]*)\}/g, (_, inner: string) => `**${inner}**`);
	out = out.replace(/\\(?:textit|emph|mathit)\{([^{}]*)\}/g, (_, inner: string) => `*${inner}*`);
	out = out.replace(
		/\\(?:text|mathrm|mathsf|mathtt|mathbb|mathcal|mathfrak|operatorname)\{([^{}]*)\}/g,
		(_, inner: string) => inner,
	);
	return out;
}

function convertFractionsAndRoots(text: string): string {
	let out = text;
	out = out.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, num: string, den: string) => `(${num})/(${den})`);
	out = out.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, (_, index: string, radicand: string) => `${index}√(${radicand})`);
	out = out.replace(/\\sqrt\{([^{}]*)\}/g, (_, radicand: string) => `√(${radicand})`);
	return out;
}

function convertEscapedSpecials(text: string): string {
	let out = text.replace(/\\([{}[\]_%&#$|])/g, (_, ch: string) => ch);
	out = out.replace(/\\ /g, ' ');
	return out;
}

function convertNamedCommands(text: string): string {
	return text.replace(
		/\\([A-Za-z]+)(?![A-Za-z])/g,
		(match, name: string) => GREEK_LETTERS[name] ?? LATEX_COMMANDS[name] ?? match,
	);
}

function convertPunctuationCommands(text: string): string {
	return text.replace(/\\([,;:!])/g, (_, ch: string) => {
		switch (ch) {
			case ',':
			case ';':
			case ':':
				return ' ';
			case '!':
				return '';
			default:
				return ch;
		}
	});
}

function convertLineBreaks(text: string): string {
	return text.replace(/\\\\/g, '\n');
}

function convertSubSuperScripts(text: string): string {
	const charsOf = (s: string): string[] => Array.from(s);

	let out = text.replace(/_\{([^{}]+)\}/g, (match, inner: string) => {
		const chars = charsOf(inner);
		if (chars.every((c) => SUBSCRIPT_MAP[c] !== undefined)) {
			return chars.map((c) => SUBSCRIPT_MAP[c]).join('');
		}
		return match;
	});
	out = out.replace(/\^\{([^{}]+)\}/g, (match, inner: string) => {
		const chars = charsOf(inner);
		if (chars.every((c) => SUPERSCRIPT_MAP[c] !== undefined)) {
			return chars.map((c) => SUPERSCRIPT_MAP[c]).join('');
		}
		return match;
	});
	// Single-character form
	out = out.replace(
		/([A-Za-z0-9)\]])_([A-Za-z0-9+\-=()])/g,
		(match, base: string, c: string) => {
			const sub = SUBSCRIPT_MAP[c];
			return sub ? `${base}${sub}` : match;
		},
	);
	out = out.replace(
		/([A-Za-z0-9)\]])\^([A-Za-z0-9+\-=()])/g,
		(match, base: string, c: string) => {
			const sup = SUPERSCRIPT_MAP[c];
			return sup ? `${base}${sup}` : match;
		},
	);
	return out;
}

function applyMathModeConversions(text: string): string {
	let out = text;
	out = convertTextFormatting(out);
	out = convertFractionsAndRoots(out);
	out = convertEscapedSpecials(out);
	out = convertLineBreaks(out);
	out = convertNamedCommands(out);
	out = convertPunctuationCommands(out);
	out = convertSubSuperScripts(out);
	return out;
}

function applyProseConversions(text: string): string {
	let out = text;
	out = convertTextFormatting(out);
	out = convertFractionsAndRoots(out);
	out = convertEscapedSpecials(out);
	// Deliberately NOT running convertLineBreaks here — outside math delimiters
	// `\\` is far more likely to be a Windows path or escaped backslash.
	out = convertNamedCommands(out);
	out = convertPunctuationCommands(out);
	return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert LaTeX-style syntax in text to terminal-friendly Unicode.
 *
 * Two-phase conversion:
 * 1. Strip `$...$` / `$$...$$` math regions, applying math-mode conversions
 *    (including sub/superscripts) to the inner text.
 * 2. Run prose-safe conversions over remaining text for unwrapped LaTeX tokens.
 *
 * Short-circuits on input that has no `\` or `$`.
 */
export function convertLatexToUnicode(input: string): string {
	if (!input) return input;
	if (input.indexOf('\\') === -1 && input.indexOf('$') === -1) {
		return input;
	}
	let text = input;
	text = stripMathDelimiters(text);
	text = applyProseConversions(text);
	return text;
}

/**
 * Detect and render fenced LaTeX code blocks (```latex ... ```) in text,
 * replacing them with Unicode-rendered content.
 */
export function renderLatexCodeBlocks(text: string): string {
	return text.replace(/```(?:latex|tex|math)\n([\s\S]*?)```/g, (_, expr: string) => {
		return convertLatexToUnicode(expr);
	});
}
