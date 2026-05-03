export interface LoginAdminInput {
  username: string;
  password: string;
}

export interface LoginAdminOutput {
  subject: string;
}

export class InvalidCredentialsError extends Error {
  public constructor(message = "Invalid credentials") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class LoginAdmin {
  public constructor(
    private readonly adminUsername: string,
    private readonly adminPassword: string,
  ) {}

  public async execute(input: LoginAdminInput): Promise<LoginAdminOutput> {
    const isUsernameValid = input.username === this.adminUsername;
    const isPasswordValid = input.password === this.adminPassword;

    if (!isUsernameValid || !isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    return {
      subject: this.adminUsername,
    };
  }
}
