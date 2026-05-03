import { Context, Hono } from "hono";
import { readFile } from "fs/promises";

export function registerOpenApiRoutes(app: Hono) {
  app.get("/openapi.yaml", async (c: Context) => {
    const filePath = "/app/docs/openapi.yaml";
    try {
      const yaml = await readFile(filePath, "utf8");
      return c.text(yaml, 200, { "Content-Type": "application/yaml" });
    } catch {
      return c.text("OpenAPI spec not found", 404);
    }
  });

  app.get("/docs", (c: Context) => {
    // Swagger UI HTML referencing /openapi.yaml
    const swaggerUrl = `${c.req.url.startsWith("http") ? "" : `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}`}/openapi.yaml`;
    const html = `<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <title>API Docs</title>
  <link rel=\"stylesheet\" href=\"https://unpkg.com/swagger-ui-dist/swagger-ui.css\" />
</head>
<body>
  <div id=\"swagger-ui\"></div>
  <script src=\"https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js\"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${swaggerUrl}',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`;
    return c.html(html);
  });
}
