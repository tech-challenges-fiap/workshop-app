export class VehicleNotFound extends Error {
  constructor(identifier: string) {
    super(`Vehicle not found: ${identifier}`);
    this.name = "VehicleNotFound";
  }
}
