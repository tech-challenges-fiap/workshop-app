import { InvalidPersonDocument } from "../domain-error/invalid-person-document";

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;
const MODULUS_BASE = 11;
const REPEATED_DIGITS_REGEX = /^(\d)\1+$/;

export class PersonDocument {
  private constructor(private readonly value: string) {}

  public static create(raw: string): PersonDocument {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new InvalidPersonDocument("Person document must not be empty");
    }

    const digitsOnly = normalized.replace(/\D/g, "");

    if (digitsOnly.length !== CPF_LENGTH && digitsOnly.length !== CNPJ_LENGTH) {
      throw new InvalidPersonDocument("Person document must have 11 or 14 digits");
    }

    if (REPEATED_DIGITS_REGEX.test(digitsOnly)) {
      throw new InvalidPersonDocument("Person document must not have all repeated digits");
    }

    const isValid =
      digitsOnly.length === CPF_LENGTH
        ? PersonDocument.isValidCpf(digitsOnly)
        : PersonDocument.isValidCnpj(digitsOnly);

    if (!isValid) {
      throw new InvalidPersonDocument("Person document must have valid check digits");
    }

    return new PersonDocument(digitsOnly);
  }

  private static isValidCpf(cpf: string): boolean {
    const digits = cpf.split("").map(Number);
    const firstDigit = PersonDocument.calculateCpfCheckDigit(digits.slice(0, 9), 10);
    const secondDigit = PersonDocument.calculateCpfCheckDigit(digits.slice(0, 10), 11);

    return digits[9] === firstDigit && digits[10] === secondDigit;
  }

  private static calculateCpfCheckDigit(digits: number[], startWeight: number): number {
    const sum = digits.reduce((acc, digit, index) => acc + digit * (startWeight - index), 0);
    const remainder = (sum * 10) % MODULUS_BASE;
    return remainder === 10 ? 0 : remainder;
  }

  private static isValidCnpj(cnpj: string): boolean {
    const digits = cnpj.split("").map(Number);
    const firstDigit = PersonDocument.calculateCnpjCheckDigit(
      digits.slice(0, 12),
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    const secondDigit = PersonDocument.calculateCnpjCheckDigit(
      digits.slice(0, 13),
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );

    return digits[12] === firstDigit && digits[13] === secondDigit;
  }

  private static calculateCnpjCheckDigit(digits: number[], weights: number[]): number {
    const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0);
    const remainder = sum % MODULUS_BASE;
    return remainder < 2 ? 0 : MODULUS_BASE - remainder;
  }

  public toString(): string {
    return this.value;
  }
}
