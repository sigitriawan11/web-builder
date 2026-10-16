import { describe, expect, it } from "vitest";
import { evaluateExpression, isRelativeExpression } from "./expression";

const value = (input: string, current?: number, precision?: number) => {
  const result = evaluateExpression(input, { current, ...(precision !== undefined ? { precision } : {}) });
  return result.ok ? result.value : result.reason;
};

describe("evaluateExpression (ED-070, tanpa eval)", () => {
  it.each([
    // AC
    ["100+20", 120],
    ["(10+5)*2", 30],
    // Dasar
    ["42", 42],
    ["  42  ", 42],
    ["42px", 42],
    ["42PX", 42],
    ["10 + 5", 15],
    ["10-5", 5],
    ["3*4", 12],
    ["12/4", 3],
    ["2+3*4", 14],
    ["(2+3)*4", 20],
    ["10-2-3", 5],
    ["100/10/2", 5],
    ["2*(3+(4-1))", 12],
    ["-5", -5],
    ["-(5+5)", -10],
    ["10*-2", -20],
    ["+7", 7],
    ["1.5", 2],
    ["1,4", 1],
    [".5*4", 2],
    ["10px+5px", 15],
    ["0", 0],
    ["-0", 0],
  ])("%s → %s", (input, expected) => {
    expect(value(input)).toBe(expected);
  });

  it.each([
    ["/2", 300, 150],
    ["+10", 300, 310],
    ["*2", 50, 100],
    ["- 10", 300, 290],
    ["+(10*2)", 100, 120],
  ])("relatif: %s pada %s → %s", (input, current, expected) => {
    expect(value(input, current)).toBe(expected);
    expect(isRelativeExpression(input)).toBe(true);
  });

  it("minus tanpa spasi = nilai negatif, bukan relatif", () => {
    expect(value("-10", 300)).toBe(-10);
    expect(isRelativeExpression("-10")).toBe(false);
  });

  it("presisi field: 2 desimal untuk rasio", () => {
    expect(value("1/3", undefined, 2)).toBe(0.33);
    expect(value("0.256", undefined, 2)).toBe(0.26);
    expect(value("1/3")).toBe(0);
  });

  it.each([
    "abc",
    "",
    "   ",
    "10++",
    "10 20",
    "(1+2",
    "1+2)",
    "()",
    "*",
    "1+",
    "10px px",
    "1e3",
    "alert(1)",
    "2**3",
    "1..2",
    "x".repeat(101),
  ])("tidak valid tanpa exception: %j", (input) => {
    expect(() => evaluateExpression(input)).not.toThrow();
    expect(value(input)).toBe("invalid");
  });

  it("pembagian dengan nol → divideByZero", () => {
    expect(value("10/0")).toBe("divideByZero");
    expect(value("/0", 50)).toBe("divideByZero");
    expect(value("10/(5-5)")).toBe("divideByZero");
  });
});
