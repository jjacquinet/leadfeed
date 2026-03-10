const MAX_PHONE_NUMBERS = 5;

function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim().toLowerCase();
  // Normalize common US format with leading country code.
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function normalizePhoneNumbers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (typeof item !== 'string') continue;
    const value = item.trim();
    if (!value) continue;

    const key = normalizePhoneKey(value);
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(value);
    if (normalized.length >= MAX_PHONE_NUMBERS) break;
  }

  return normalized;
}

export function mergePhoneNumbers(existing: string[], incoming: string[]): string[] {
  return normalizePhoneNumbers([...existing, ...incoming]).slice(0, MAX_PHONE_NUMBERS);
}

export function primaryPhoneFromList(phoneNumbers: string[]): string | null {
  return phoneNumbers.length > 0 ? phoneNumbers[0] : null;
}

export { MAX_PHONE_NUMBERS };
