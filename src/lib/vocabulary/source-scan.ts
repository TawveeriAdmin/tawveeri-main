// §1b — CUSTOMER-FACING TEXT IN REPOSITORY SOURCE, extracted through the TypeScript AST.
//
// WHY AN AST AND NOT REGEX. The regex version read quoted literals only, so the claim that
// mattered most escaped three consecutive scans: «من جميع المتاجر» in `how-it-works` is JSX TEXT
// CONTENT, which carries no quotes. Regex also could not tell a comment from copy (it read
// `about/page.tsx`'s record of a REMOVED claim as the violation) and could not tell a sentence
// from syntax (`{t('…')}: <Price` was captured across alternating quotes). Each of those is a
// parsing question, and a parser answers them by construction.
//
// ONE POLICY, NOT TWO. This module extracts CANDIDATE TEXT ONLY. Whether a string is a violation
// is decided exclusively by `checkCustomerText` against the approved vocabulary — there is no
// second rule set here, and adding one would be the drift F7·1 exists to prevent.
import ts from 'typescript';

export type TextKind =
  | 'jsx-text'          // <p>…</p> — the class that escaped three scans
  | 'jsx-attribute'     // alt, aria-label, placeholder, title
  | 'string-literal'    // 'copy' / "copy"
  | 'template-literal'; // `copy ${value}` — static spans only

export interface SourceText {
  kind: TextKind;
  text: string;
  line: number;
}

/**
 * JSX attributes whose value a customer READS or HEARS.
 *
 * Accessible names are customer-facing language even though no sighted user sees them — a screen
 * reader announces them, and a forbidden claim spoken aloud is still a forbidden claim.
 */
const CUSTOMER_ATTRIBUTES = new Set([
  'alt', 'aria-label', 'aria-description', 'aria-placeholder',
  'placeholder', 'title', 'label', 'aria-valuetext',
]);

/**
 * Attributes that are machinery. Enumerated as a DENY list used only for reporting clarity —
 * the allow list above is what actually decides, so a new attribute is ignored until someone
 * declares it customer-facing rather than being scanned by accident.
 */
const MACHINE_ATTRIBUTES = new Set([
  'className', 'class', 'id', 'key', 'href', 'src', 'type', 'name', 'role',
  'value', 'htmlFor', 'style', 'width', 'height', 'rel', 'target',
]);

/** A string is prose if a person could read it as a sentence fragment. */
export function looksLikeProse(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  if (!/\s/.test(t)) return false;                    // one token → identifier, class, route
  if (!/[A-Za-z؀-ۿ]/.test(t)) return false; // no letters → not language
  // Code that survived quoting: JSX fragments, arrow functions, selectors, urls, css.
  if (/[<>{}]|=>|https?:\/\/|\bclassName\b|data-testid|\bpx-\d|\btext-\[/.test(t)) return false;
  return true;
}

/**
 * Every customer-facing text candidate in one source file.
 *
 * COMMENTS ARE EXCLUDED BY CONSTRUCTION: the AST does not surface them as nodes, so the class of
 * false positive that read our own audit trail as a defect cannot recur.
 */
export function extractCustomerText(fileName: string, source: string): SourceText[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: SourceText[] = [];
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const push = (kind: TextKind, raw: string, pos: number) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (looksLikeProse(text)) out.push({ kind, text, line: lineOf(pos) });
  };

  const visit = (node: ts.Node): void => {
    // 1. JSX TEXT — the blind spot this module exists to close.
    if (ts.isJsxText(node)) {
      push('jsx-text', node.text, node.getStart(sf));
      return;
    }

    // 2. JSX ATTRIBUTES a customer reads or hears.
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (CUSTOMER_ATTRIBUTES.has(name) && node.initializer) {
        const init = node.initializer;
        if (ts.isStringLiteral(init)) push('jsx-attribute', init.text, init.getStart(sf));
        else if (ts.isJsxExpression(init) && init.expression) collectFromExpression(init.expression, 'jsx-attribute');
      }
      // Never descend into a machine attribute's value.
      if (MACHINE_ATTRIBUTES.has(name)) return;
    }

    // 3. STRING and TEMPLATE literals anywhere else (component copy, shared constants,
    //    metadata, JSON-LD builders, validation messages, empty/error states).
    if (ts.isStringLiteral(node) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
      if (!ts.isJsxAttribute(node.parent)) push('string-literal', node.text, node.getStart(sf));
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) push('template-literal', node.text, node.getStart(sf));
    if (ts.isTemplateExpression(node)) {
      // STATIC SPANS ONLY. `${price} ريال` contributes « ريال»; the interpolated value is
      // runtime data and is governed by the F7 validator, not by a repository scan. Scanning a
      // placeholder as if it were copy would report a claim nobody wrote.
      push('template-literal', node.head.text, node.getStart(sf));
      for (const span of node.templateSpans) push('template-literal', span.literal.text, span.literal.getStart(sf));
    }

    ts.forEachChild(node, visit);
  };

  const collectFromExpression = (expr: ts.Node, kind: TextKind) => {
    if (ts.isStringLiteral(expr)) push(kind, expr.text, expr.getStart(sf));
    else ts.forEachChild(expr, (c) => collectFromExpression(c, kind));
  };

  visit(sf);
  return out;
}
