import { handleRequest } from "./app.ts";

const port = Number(Bun.env.PORT ?? 3000);

if (import.meta.main) {
  Bun.serve({
    port,
    fetch: handleRequest,
  });

  console.log(`workshop-app listening on port ${port}`);
}

