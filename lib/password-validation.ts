export const STRONG_PASSWORD_PATTERN = /^(?=.{8,64}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S+$/;

export const STRONG_PASSWORD_REQUIREMENTS =
  "Use 8–64 characters with at least one uppercase letter, one lowercase letter, one number, and one special character. Spaces are not allowed.";

export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_PATTERN.test(password);
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  if (isStrongPassword(password)) return "strong";

  const satisfiedRules = [
    password.length >= 8 && password.length <= 64,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    !/\s/.test(password),
  ].filter(Boolean).length;

  return satisfiedRules >= 4 ? "medium" : "weak";
}
