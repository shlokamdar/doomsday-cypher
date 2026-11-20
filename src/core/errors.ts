/** An error whose message is safe to show to the user. */
export class UserError extends Error {
  readonly userFacing = true;
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export function isUserError(e: unknown): e is UserError {
  return !!e && typeof e === "object" && (e as { userFacing?: boolean }).userFacing === true;
}
