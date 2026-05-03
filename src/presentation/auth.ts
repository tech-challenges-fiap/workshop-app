import type { Hono } from "hono";

import type { LoginAdmin } from "../application/auth/login-admin";

export function registerAuthRoutes(app: Hono, deps: { loginAdmin: LoginAdmin }): void {
  void deps;

  app.post("/auth/login", (c) => {
    return c.json(
      {
        error: "AuthDelegated",
        message: "Authentication is delegated to workshop-edge auth-cpf.",
      },
      410,
    );
  });
}
