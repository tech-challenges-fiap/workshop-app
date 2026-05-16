export class InsufficientStock extends Error {
  public readonly name = "InsufficientStock";

  constructor() {
    super("Cannot consume more stock than available");
  }
}
