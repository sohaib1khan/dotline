const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "qwerty", "asdf", "zxcv"];

export function validatePersonName(value: string): string | null {
  const cleaned = value.trim();
  if (cleaned.length < 2 || cleaned.length > 50) return "Must be 2–50 characters.";
  if (/\d/.test(cleaned)) return "Names cannot include numbers.";
  if (!/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u.test(cleaned)) {
    return "Use letters, spaces, hyphens, or apostrophes only.";
  }
  const folded = cleaned.toLowerCase().replace(/[ '\-]/g, "");
  if (/(.)\1\1/.test(folded)) return "That name looks invalid. Please use your real name.";
  if (KEYBOARD_ROWS.some((row) => folded.includes(row))) {
    return "That name looks invalid. Please use your real name.";
  }
  if (/^(.{2,3})\1+$/.test(folded)) {
    return "That name looks invalid. Please use your real name.";
  }
  return null;
}

export function validateUsername(value: string): string | null {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(value.trim())) {
    return "Username must be 3–24 letters, numbers, or underscore.";
  }
  return null;
}

export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["Very weak", "Weak", "Okay", "Strong", "Very strong", "Excellent"];
  return { score, label: labels[Math.min(score, labels.length - 1)] ?? "Weak" };
}
