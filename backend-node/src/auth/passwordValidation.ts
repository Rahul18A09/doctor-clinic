const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "abc123",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
]);

export function validateNewPassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) {
    errors.push("This password is too short. It must contain at least 8 characters.");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    errors.push("This password is too common.");
  }
  if (/^\d+$/.test(password)) {
    errors.push("This password is entirely numeric.");
  }
  return errors;
}
