export class InvalidPersonDocument extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPersonDocument";
  }
}
