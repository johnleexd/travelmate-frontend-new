export const STRONG_PASSWORD_PATTERN = /^(?=.{8,64}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S+$/;

export const STRONG_PASSWORD_REQUIREMENTS =
  "Use 8–64 characters with at least one uppercase letter, one lowercase letter, one number, and one special character. Spaces are not allowed.";

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_PATTERN.test(password);
}
