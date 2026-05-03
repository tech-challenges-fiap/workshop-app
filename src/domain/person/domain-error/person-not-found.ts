export class PersonNotFound extends Error {
  constructor(identifier: string) {
    super(`Person not found: ${identifier}`);
    this.name = "PersonNotFound";
  }
}
