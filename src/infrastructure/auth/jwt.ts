import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash } from "node:crypto";

export interface JwtPayload {
  sub: string;
  person_id: string;
  cpf: string;
  role: string;
  status: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
}

export class InvalidTokenError extends Error {
  public constructor(message = "Invalid token") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export class TokenExpiredError extends Error {
  public constructor(message = "Token has expired") {
    super(message);
    this.name = "TokenExpiredError";
  }
}

export class InactivePersonTokenError extends Error {
  public constructor(status: string) {
    super(`Token subject is not active: ${status}`);
    this.name = "InactivePersonTokenError";
  }
}

export interface VerifiedAuthContext {
  subject: string;
  personId: string;
  cpfHash: string;
  role: string;
  status: string;
  jti: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length === 0) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  return secret;
}

function getExpiresIn(): SignOptions["expiresIn"] | undefined {
  const expiresIn = process.env.JWT_EXPIRES_IN;

  if (!expiresIn || expiresIn.length === 0) {
    return undefined;
  }

  // jsonwebtoken's type for `expiresIn` is a branded/string-literal union;
  // we trust the env format here and cast to the expected type.
  return expiresIn as unknown as SignOptions["expiresIn"];
}

function getIssuer(): string {
  return process.env.JWT_ISSUER?.trim() || "workshop-edge";
}

function getAudience(): string {
  return process.env.JWT_AUDIENCE?.trim() || "workshop-app";
}

function assertStringClaim(payload: Record<string, unknown>, claim: keyof JwtPayload): string {
  const value = payload[claim];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidTokenError(`Token payload does not contain a valid '${claim}'`);
  }

  return value;
}

function assertNumberClaim(payload: Record<string, unknown>, claim: keyof JwtPayload): number {
  const value = payload[claim];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidTokenError(`Token payload does not contain a valid '${claim}'`);
  }

  return value;
}

export function hashCpf(cpf: string): string {
  return createHash("sha256").update(cpf).digest("hex");
}

export function signToken(
  payload: Partial<JwtPayload> & { sub: string },
  options?: SignOptions,
): string {
  const secret = getSecret();

  const expiresIn = getExpiresIn();

  const effectiveOptions: SignOptions = {
    ...(options ?? {}),
  };

  if (expiresIn !== undefined) {
    effectiveOptions.expiresIn = expiresIn;
  } else if (payload.exp === undefined) {
    effectiveOptions.expiresIn = "15m" as SignOptions["expiresIn"];
  }

  const effectivePayload = {
    person_id: payload.person_id ?? payload.sub,
    cpf: payload.cpf ?? "00000000000",
    role: payload.role ?? "front-desk",
    status: payload.status ?? "active",
    jti: payload.jti ?? `local-${Date.now()}`,
    ...payload,
  };

  return jwt.sign(effectivePayload, secret, {
    algorithm: "HS256",
    issuer: getIssuer(),
    audience: getAudience(),
    ...(effectiveOptions ?? {}),
  });
}

export function verifyToken(token: string): JwtPayload {
  const secret = getSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: getIssuer(),
      audience: getAudience(),
    });

    if (typeof decoded === "string") {
      throw new InvalidTokenError("Token payload is not an object");
    }

    const payload = decoded as Record<string, unknown>;

    const requiredPayload: JwtPayload = {
      sub: assertStringClaim(payload, "sub"),
      person_id: assertStringClaim(payload, "person_id"),
      cpf: assertStringClaim(payload, "cpf"),
      role: assertStringClaim(payload, "role"),
      status: assertStringClaim(payload, "status"),
      iss: assertStringClaim(payload, "iss"),
      aud: assertStringClaim(payload, "aud"),
      exp: assertNumberClaim(payload, "exp"),
      iat: assertNumberClaim(payload, "iat"),
      jti: assertStringClaim(payload, "jti"),
    };

    if (requiredPayload.status !== "active") {
      throw new InactivePersonTokenError(requiredPayload.status);
    }

    return requiredPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError(error.message);
    }

    if (error instanceof InactivePersonTokenError || error instanceof InvalidTokenError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new InvalidTokenError(error.message);
    }

    throw new InvalidTokenError("Unknown token verification error");
  }
}

export function verifyAuthContext(token: string): VerifiedAuthContext {
  const payload = verifyToken(token);

  return {
    subject: payload.sub,
    personId: payload.person_id,
    cpfHash: hashCpf(payload.cpf),
    role: payload.role,
    status: payload.status,
    jti: payload.jti,
  };
}
