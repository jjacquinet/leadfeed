/* eslint-disable @typescript-eslint/no-explicit-any */

import { normalizePhoneNumbers } from '@/lib/phones';

const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL || 'https://api.apollo.io/api/v1';

function getApolloHeaders(): HeadersInit {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error('APOLLO_API_KEY not configured');
  }

  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  };
}

function collectPhoneCandidates(value: any, keyPath = ''): string[] {
  if (value == null) return [];

  if (typeof value === 'string') {
    // Accept only values that look like phone numbers.
    return /\d{7,}/.test(value) ? [value] : [];
  }

  if (typeof value === 'number') {
    const asString = String(value);
    return /\d{7,}/.test(asString) ? [asString] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPhoneCandidates(item, keyPath));
  }

  if (typeof value === 'object') {
    const out: string[] = [];

    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = keyPath ? `${keyPath}.${key}` : key;
      const keyLooksLikePhone = key.toLowerCase().includes('phone');

      if (keyLooksLikePhone) {
        out.push(...collectPhoneCandidates(nestedValue, nestedPath));
        continue;
      }

      if (nestedValue && typeof nestedValue === 'object') {
        out.push(...collectPhoneCandidates(nestedValue, nestedPath));
      }
    }

    return out;
  }

  return [];
}

export async function enrichPhonesFromApollo(params: {
  linkedinUrl?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  webhookUrl?: string | null;
}): Promise<{ phones: string[]; raw: any; deferred: boolean }> {
  const body: Record<string, unknown> = {};

  if (params.linkedinUrl) {
    body.linkedin_url = params.linkedinUrl;
  } else if (params.email) {
    body.email = params.email;
  } else if (params.firstName && params.lastName && params.company) {
    body.first_name = params.firstName;
    body.last_name = params.lastName;
    body.organization_name = params.company;
  } else {
    return { phones: [], raw: null, deferred: false };
  }

  if (params.webhookUrl) {
    body.reveal_phone_number = true;
    body.webhook_url = params.webhookUrl;
  }

  const response = await fetch(`${APOLLO_BASE_URL}/people/match`, {
    method: 'POST',
    headers: getApolloHeaders(),
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Apollo request failed (${response.status})`;
    throw new Error(message);
  }

  const phones = normalizePhoneNumbers(collectPhoneCandidates(payload));
  return {
    phones,
    raw: payload,
    deferred: Boolean(params.webhookUrl) && phones.length === 0,
  };
}
