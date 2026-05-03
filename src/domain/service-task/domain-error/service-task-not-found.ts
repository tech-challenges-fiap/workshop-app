export class ServiceTaskNotFound extends Error {
  // eslint-disable-next-line no-secrets/no-secrets
  public readonly name = "ServiceTaskNotFound";

  constructor(id: number) {
    super(`Service task '${String(id)}' was not found`);
  }
}
