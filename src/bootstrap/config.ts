export interface AppRuntimeConfig {
  adminUsername: string;
  adminPassword: string;
  beeceptorNotificationUrl: string;
  appPort: number;
  jwtSecret: string | undefined;
  jwtIssuer: string;
  jwtAudience: string;
  appEnv: string;
}

export function loadRuntimeConfig(): AppRuntimeConfig {
  return {
    adminUsername: process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "change-me",
    beeceptorNotificationUrl:
      process.env.BEECEPTOR_NOTIFICATION_URL ?? "https://app.beeceptor.com/console/14soat-group61",
    appPort: Number(process.env.APP_PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: process.env.JWT_ISSUER ?? "workshop-edge",
    jwtAudience: process.env.JWT_AUDIENCE ?? "workshop-app",
    appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? "local",
  };
}
