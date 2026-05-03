import { describe, expect, it } from "bun:test";

import { InvalidPersonDocument } from "../domain-error/invalid-person-document";
import { PersonDocument } from "./person-document";

describe("PersonDocument", () => {
  it("accepts a valid CPF", () => {
    expect(PersonDocument.create("52998224725").toString()).toBe("52998224725");
  });

  it("accepts a valid CNPJ", () => {
    expect(PersonDocument.create("11444777000161").toString()).toBe("11444777000161");
  });

  it("normalizes formatted CPF input", () => {
    expect(PersonDocument.create("529.982.247-25").toString()).toBe("52998224725");
  });

  it("normalizes formatted CNPJ input", () => {
    expect(PersonDocument.create("11.444.777/0001-61").toString()).toBe("11444777000161");
  });

  it("rejects invalid CPF check digits", () => {
    expect(() => PersonDocument.create("52998224724")).toThrowError(InvalidPersonDocument);
    expect(() => PersonDocument.create("52998224724")).toThrowError(
      "Person document must have valid check digits",
    );
  });

  it("rejects invalid CNPJ check digits", () => {
    expect(() => PersonDocument.create("11444777000162")).toThrowError(InvalidPersonDocument);
    expect(() => PersonDocument.create("11444777000162")).toThrowError(
      "Person document must have valid check digits",
    );
  });

  it("rejects repeated-digit CPF and CNPJ", () => {
    expect(() => PersonDocument.create("11111111111")).toThrowError(InvalidPersonDocument);
    expect(() => PersonDocument.create("00000000000000")).toThrowError(InvalidPersonDocument);
  });
});
