export function getRegistrationDetailsError(firstName: string, lastName: string, phone: string): string | null {
  if (!firstName.trim()) return 'Enter your first name.';
  if (!lastName.trim()) return 'Enter your last name.';
  if (`${firstName.trim()} ${lastName.trim()}`.length > 80) return 'Your first and last name together must be 80 characters or fewer.';
  return getContactNumberError(phone);
}

export function getContactNumberError(phone: string): string | null {
  return normalizePhilippineMobile(phone) === null ? 'Enter a 10-digit Philippine mobile number (e.g. 917 123 4567).' : null;
}
import { normalizePhilippineMobile } from './philippine-mobile.ts';

