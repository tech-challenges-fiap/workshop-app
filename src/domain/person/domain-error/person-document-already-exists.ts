export class PersonDocumentAlreadyExists extends Error {
  constructor(document: string) {
    super(`Person with document '${document}' already exists`);
    // eslint-disable-next-line no-secrets/no-secrets
    this.name = "PersonDocumentAlreadyExists";
  }
}
