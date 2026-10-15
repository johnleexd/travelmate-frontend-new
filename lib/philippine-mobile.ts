/** Extract national digits without discarding an overlong or malformed number. */
export function philippineMobileDigits(input: string): string | null {
  const value = input.trim();
  if (!/^\+?[0-9\s().-]*$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (value.startsWith('+')) {
    if (!digits.startsWith('63')) return null;
    digits = digits.slice(2);
  } else if (digits.startsWith('63') && digits.length >= 12) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function normalizePhilippineMobile(input: string): string | null {
  if (!input.trim()) return '';
  const digits = philippineMobileDigits(input);
  return digits && /^[89]\d{9}$/.test(digits) ? '+63' + digits : null;
}

export function formatPhilippineMobile(input: string): string {
  const digits = philippineMobileDigits(input);
  if (digits === null) return input;
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(' ');
}
