import { signToken } from "../src/infrastructure/auth/jwt";

const baseUrl = process.env.DEPLOY_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function assertGet(
  path: string,
  expectedStatus: number,
  headers?: HeadersInit,
): Promise<unknown> {
  const response = await fetch(new URL(path, baseUrl), { headers });
  const body = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} returned ${response.status}; expected ${expectedStatus}. Response: ${body}`,
    );
  }

  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${path} did not return JSON. Response: ${body}`);
  }
}

await assertGet("/health", 200);
await assertGet("/ready", 200);

const token = signToken({
  sub: "deploy-smoke",
  person_id: "deploy-smoke",
  cpf: "00000000000",
  role: "front-desk",
  status: "active",
  jti: `deploy-smoke-${Date.now()}`,
});

const workOrders = await assertGet("/work-orders", 200, {
  Authorization: `Bearer ${token}`,
});

if (!Array.isArray(workOrders)) {
  throw new Error("/work-orders did not return a JSON array");
}

console.log("Deploy smoke checks passed.");
