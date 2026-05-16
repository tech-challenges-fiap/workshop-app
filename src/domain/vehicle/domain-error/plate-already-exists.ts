export class PlateAlreadyExists extends Error {
  constructor(plate: string) {
    super(`Vehicle with plate '${plate}' already exists`);
    this.name = "PlateAlreadyExists";
  }
}
