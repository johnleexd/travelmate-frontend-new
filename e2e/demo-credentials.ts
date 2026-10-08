export function demoPassword(role: 'traveler' | 'admin'): string {
  const key = role === 'admin' ? 'DEMO_ADMIN_PASSWORD' : 'DEMO_TRAVELER_PASSWORD';
  const value = process.env[key];
  if (!value || value.length < 16) throw new Error(`Set ${key} to the unique password used to seed your isolated test database.`);
  return value;
}
