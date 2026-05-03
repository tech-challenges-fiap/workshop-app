export class InvalidServicePrice extends Error {
  constructor(public readonly value: number) {
    super(`Invalid service price: '${String(value)}'`);
    this.name = "InvalidServicePrice";
  }
}
