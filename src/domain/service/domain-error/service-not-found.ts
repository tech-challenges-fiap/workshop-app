export class ServiceNotFound extends Error {
  constructor(public readonly id: number) {
    super(`Service with id '${String(id)}' was not found`);
    this.name = "ServiceNotFound";
  }
}
