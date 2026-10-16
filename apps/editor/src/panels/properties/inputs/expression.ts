// ED-070: ekspresi numerik input inspector — tokenizer kecil + shunting-yard (tanpa eval / new Function, CLAUDE.md).
// Operator + - * / ( ), unary minus, unit opsional `px`; diawali operator biner (`+10`, `/2`, `*3`) = relatif ke nilai
// sekarang (seperti Figma). Hasil dibulatkan sesuai presisi field. Persen relatif = P1; variabel = P2.

export type ExpressionResult = { ok: true; value: number } | { ok: false; reason: "invalid" | "divideByZero" };

type Token =
  | { kind: "number"; value: number }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "paren"; open: boolean };

const MAX_LENGTH = 100;
const INVALID: ExpressionResult = { ok: false, reason: "invalid" };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index] as string;
    if (char === " ") {
      index++;
      continue;
    }
    if ("+-*/".includes(char)) {
      tokens.push({ kind: "op", op: char as "+" | "-" | "*" | "/" });
      index++;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", open: char === "(" });
      index++;
      continue;
    }
    const number = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:px)?/i.exec(input.slice(index));
    if (!number) return null;
    tokens.push({ kind: "number", value: Number(number[0].replace(/px$/i, "").replace(",", ".")) });
    index += number[0].length;
  }
  return tokens;
}

const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2, neg: 3 } as const;
type Operator = keyof typeof PRECEDENCE;

/** Evaluasi ekspresi infix; null = sintaks tidak valid; "divideByZero" bila membagi 0. */
function evaluate(tokens: readonly Token[]): number | null | "divideByZero" {
  const output: number[] = [];
  const operators: (Operator | "(")[] = [];
  let expectOperand = true;

  const apply = (op: Operator): boolean | "divideByZero" => {
    if (op === "neg") {
      const value = output.pop();
      if (value === undefined) return false;
      output.push(-value);
      return true;
    }
    const right = output.pop();
    const left = output.pop();
    if (right === undefined || left === undefined) return false;
    if (op === "/" && right === 0) return "divideByZero";
    output.push(op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right : left / right);
    return true;
  };

  for (const token of tokens) {
    if (token.kind === "number") {
      if (!expectOperand) return null;
      output.push(token.value);
      expectOperand = false;
    } else if (token.kind === "paren") {
      if (token.open) {
        if (!expectOperand) return null;
        operators.push("(");
      } else {
        if (expectOperand) return null;
        for (;;) {
          const top = operators.pop();
          if (top === undefined) return null;
          if (top === "(") break;
          const result = apply(top);
          if (result !== true) return result === false ? null : result;
        }
      }
    } else {
      // Unary: minus/plus di posisi operand.
      if (expectOperand) {
        if (token.op === "-") operators.push("neg");
        else if (token.op !== "+") return null;
        continue;
      }
      const op: Operator = token.op;
      while (operators.length > 0) {
        const top = operators[operators.length - 1] as Operator | "(";
        if (top === "(" || PRECEDENCE[top] < PRECEDENCE[op]) break;
        operators.pop();
        const result = apply(top);
        if (result !== true) return result === false ? null : result;
      }
      operators.push(op);
      expectOperand = true;
    }
  }
  if (expectOperand) return null;
  while (operators.length > 0) {
    const top = operators.pop() as Operator | "(";
    if (top === "(") return null;
    const result = apply(top);
    if (result !== true) return result === false ? null : result;
  }
  return output.length === 1 ? (output[0] as number) : null;
}

export interface EvaluateOptions {
  // Nilai sekarang (untuk ekspresi relatif `+10`, `/2`); multi-seleksi = per node.
  current?: number | undefined;
  // Jumlah desimal (0 = px, 2 = opacity/line-height ratio).
  precision?: number;
}

/** Hitung isi input numerik; tidak pernah melempar. */
export function evaluateExpression(input: string, options: EvaluateOptions = {}): ExpressionResult {
  const text = input.trim();
  if (text === "" || text.length > MAX_LENGTH) return INVALID;
  const tokens = tokenize(text);
  if (!tokens || tokens.length === 0) return INVALID;
  // Relatif: diawali operator biner (bukan minus tunggal yang berarti negatif) → `current <op> sisa`.
  const first = tokens[0];
  let effective: readonly Token[] = tokens;
  if (first?.kind === "op" && first.op !== "-" && options.current !== undefined) {
    effective = [
      { kind: "number", value: options.current },
      first,
      { kind: "paren", open: true },
      ...tokens.slice(1),
      { kind: "paren", open: false },
    ];
  } else if (first?.kind === "op" && first.op === "-" && options.current !== undefined && text.startsWith("- ")) {
    // "- 10" dengan spasi = relatif kurang (Figma); "-10" = nilai negatif.
    effective = [
      { kind: "number", value: options.current },
      first,
      { kind: "paren", open: true },
      ...tokens.slice(1),
      { kind: "paren", open: false },
    ];
  }
  const value = evaluate(effective);
  if (value === "divideByZero") return { ok: false, reason: "divideByZero" };
  if (value === null || !Number.isFinite(value)) return INVALID;
  const factor = 10 ** (options.precision ?? 0);
  // `+ 0` menormalkan -0 menjadi 0.
  return { ok: true, value: Math.round(value * factor) / factor + 0 };
}

/** Relatif? (multi-seleksi: relatif diterapkan per node, absolut sama untuk semua). */
export function isRelativeExpression(input: string): boolean {
  const text = input.trim();
  return /^[+*/]/.test(text) || text.startsWith("- ");
}
