export type HealthPayload = {
  service: "workshop-app";
  status: "ok";
  timestamp: string;
};

export function buildHealthPayload(now = new Date()): HealthPayload {
  return {
    service: "workshop-app",
    status: "ok",
    timestamp: now.toISOString(),
  };
}

export function handleRequest(request: Request): Response {
  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return Response.json(buildHealthPayload());
  }

  return new Response("Not Found", { status: 404 });
}

