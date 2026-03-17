import { NextRequest, NextResponse } from 'next/server';
import { enrichPhonesFromApollo } from '@/lib/apollo';

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const linkedinUrl =
      typeof body?.linkedin_url === 'string' ? body.linkedin_url.trim() : '';

    if (!linkedinUrl) {
      return NextResponse.json({ error: 'Missing linkedin_url' }, { status: 400 });
    }

    const enrichment = await enrichPhonesFromApollo({ linkedinUrl });
    const raw = asObject(enrichment.raw);
    const person = asObject(raw.person);
    const organization = asObject(person.organization);

    const first_name = pickString(person.first_name, person.firstName, raw.first_name);
    const last_name = pickString(person.last_name, person.lastName, raw.last_name);
    const title = pickString(person.title, person.headline, raw.title);
    const company = pickString(
      organization.name,
      person.organization_name,
      person.company,
      raw.organization_name
    );
    const company_website = pickString(
      organization.website_url,
      organization.website,
      person.company_website,
      raw.company_website
    );
    const email = pickString(
      person.email,
      person.email_address,
      person.work_email,
      raw.email
    );
    const phone = enrichment.phones[0] || null;

    const matched = Boolean(
      first_name || last_name || title || company || company_website || email || phone
    );

    if (!matched) {
      return NextResponse.json({ matched: false });
    }

    return NextResponse.json({
      matched: true,
      data: {
        first_name: first_name || '',
        last_name: last_name || '',
        title: title || '',
        company: company || '',
        company_website: company_website || '',
        email: email || '',
        phone: phone || '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apollo enrichment failed';
    if (/not found|no match|no person/i.test(message)) {
      return NextResponse.json({ matched: false });
    }
    console.error('[apollo] enrich-linkedin error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
