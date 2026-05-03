import { describe, expect, it } from "bun:test";

import { Money } from "./money";

describe("Money", () => {
  it("creates a Money instance with integer amount", () => {
    const money = Money.create(100);

    expect(money.toNumber()).toBe(100);
  });

  it("creates a Money instance with decimal amount up to two places", () => {
    const money = Money.create(199.99);

    expect(money.toNumber()).toBe(199.99);
  });

  it("accepts values with floating-point noise", () => {
    const money = Money.create(0.1 + 0.2);

    expect(money.toNumber()).toBe(0.3);
  });

  it("does not allow more than two decimal places", () => {
    expect(() => Money.create(10.999)).toThrow("Money amount must have at most two decimal places");
  });

  it("does not allow negative amounts", () => {
    expect(() => Money.create(-1)).toThrow("Money amount cannot be negative");
  });

  it("does not allow non-finite amounts", () => {
    expect(() => Money.create(Number.POSITIVE_INFINITY)).toThrow(
      "Money amount must be a finite number",
    );
  });

  it("compares equality by value", () => {
    const a = Money.create(50.5);
    const b = Money.create(50.5);
    const c = Money.create(10);

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("adds two Money values and returns a new instance", () => {
    const a = Money.create(10.25);
    const b = Money.create(5.75);

    const result = a.add(b);

    expect(result.toNumber()).toBe(16);
    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
  });

  it("multiplies Money by an integer multiplier", () => {
    const money = Money.create(12.5);

    const result = money.multiplyBy(3);

    expect(result.toNumber()).toBe(37.5);
  });

  it("does not allow invalid multipliers", () => {
    const money = Money.create(10);

    expect(() => money.multiplyBy(-1)).toThrow("Money multiplier cannot be negative");
    expect(() => money.multiplyBy(1.5)).toThrow("Money multiplier must be an integer");
    expect(() => money.multiplyBy(Number.POSITIVE_INFINITY)).toThrow(
      "Money multiplier must be a finite number",
    );
  });
});
