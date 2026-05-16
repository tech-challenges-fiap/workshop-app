import { beforeEach, describe, expect, it } from "bun:test";
import jwt, { type JwtPayload } from "jsonwebtoken";

import {
  InactivePersonTokenError,
  InvalidTokenError,
  TokenExpiredError,
  signToken,
  verifyToken,
} from "./jwt";

const originalVerify = jwt.verify;

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  delete process.env.JWT_EXPIRES_IN;
  // restore original verify implementation before each test
  (jwt as unknown as { verify: typeof originalVerify }).verify = originalVerify;
});

describe("signToken", () => {
  it("throws when JWT_SECRET is not set", () => {
    delete process.env.JWT_SECRET;

    expect(() => signToken({ sub: "123" })).toThrowError(
      "JWT_SECRET environment variable is not set",
    );
  });

  it("signs a token with default options when JWT_EXPIRES_IN is not set", () => {
    const token = signToken({ sub: "123" });

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("applies expiresIn from environment when set", () => {
    process.env.JWT_EXPIRES_IN = "1h";
    const token = signToken({ sub: "123" });

    const decoded = jwt.decode(token) as JwtPayload | null;
    expect(decoded).not.toBeNull();
    expect(typeof decoded?.exp).toBe("number");
    expect(typeof decoded?.iat).toBe("number");
    // token should have a positive lifetime
    expect((decoded!.exp as number) - (decoded!.iat as number)).toBeGreaterThan(0);
  });
});

describe("verifyToken", () => {
  it("returns payload when token is valid", () => {
    const token = signToken({
      sub: "123",
      person_id: "123",
      cpf: "12345678900",
      role: "front-desk",
      status: "active",
      jti: "token-1",
    });

    const payload = verifyToken(token);

    expect(payload).toMatchObject({
      sub: "123",
      person_id: "123",
      cpf: "12345678900",
      role: "front-desk",
      status: "active",
      iss: "workshop-edge",
      aud: "workshop-app",
      jti: "token-1",
    });
  });

  it("throws InvalidTokenError when audience is invalid", () => {
    const token = jwt.sign(
      {
        sub: "123",
        person_id: "123",
        cpf: "12345678900",
        role: "front-desk",
        status: "active",
        jti: "token-1",
      },
      process.env.JWT_SECRET!,
      {
        algorithm: "HS256",
        issuer: "workshop-edge",
        audience: "other-app",
      },
    );

    expect(() => verifyToken(token)).toThrowError(InvalidTokenError);
  });

  it("throws InactivePersonTokenError when status is not active", () => {
    const token = signToken({
      sub: "123",
      person_id: "123",
      cpf: "12345678900",
      role: "front-desk",
      status: "blocked",
      jti: "token-1",
    });

    expect(() => verifyToken(token)).toThrowError(InactivePersonTokenError);
  });

  it("throws InvalidTokenError when payload is a string", () => {
    (jwt as unknown as { verify: (...args: unknown[]) => unknown }).verify = () => "not-an-object";

    expect(() => verifyToken("token")).toThrowError(
      new InvalidTokenError("Token payload is not an object"),
    );
  });

  it("throws InvalidTokenError when payload.sub is missing", () => {
    (jwt as unknown as { verify: (...args: unknown[]) => unknown }).verify = () =>
      ({}) as JwtPayload;

    expect(() => verifyToken("token")).toThrowError(
      new InvalidTokenError("Token payload does not contain a valid 'sub'"),
    );
  });

  it("wraps TokenExpiredError into TokenExpiredError", () => {
    (jwt as unknown as { verify: (...args: unknown[]) => unknown }).verify = () => {
      throw new jwt.TokenExpiredError("jwt expired", new Date());
    };

    expect(() => verifyToken("expired")).toThrowError(new TokenExpiredError("jwt expired"));
  });

  it("wraps other errors into InvalidTokenError", () => {
    (jwt as unknown as { verify: (...args: unknown[]) => unknown }).verify = () => {
      throw new Error("boom");
    };

    expect(() => verifyToken("invalid")).toThrowError(new InvalidTokenError("boom"));
  });

  it("wraps non-Error values into InvalidTokenError", () => {
    (jwt as unknown as { verify: (...args: unknown[]) => unknown }).verify = () => {
      throw "bad";
    };

    expect(() => verifyToken("invalid")).toThrowError(
      new InvalidTokenError("Unknown token verification error"),
    );
  });
});
