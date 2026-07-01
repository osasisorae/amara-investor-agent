import 'server-only';

import { isIP } from 'node:net';

interface HeaderReader {
  get(name: string): string | null | undefined;
}

type ClientIpSource = HeaderReader | { headers: HeaderReader };

const DIRECT_IP_HEADERS = [
  'x-vercel-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'fly-client-ip',
] as const;

function resolveHeaders(source: ClientIpSource): HeaderReader {
  return 'headers' in source ? source.headers : source;
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim();

  if (!candidate || candidate.toLowerCase() === 'unknown') {
    return null;
  }

  if (candidate.startsWith('"') && candidate.endsWith('"')) {
    candidate = candidate.slice(1, -1).trim();
  }

  if (candidate.startsWith('[')) {
    const closingBracketIndex = candidate.indexOf(']');

    if (closingBracketIndex > 0) {
      candidate = candidate.slice(1, closingBracketIndex).trim();
    }
  } else if (
    candidate.includes('.') &&
    candidate.includes(':') &&
    candidate.indexOf(':') === candidate.lastIndexOf(':')
  ) {
    const portSeparatorIndex = candidate.lastIndexOf(':');
    const port = candidate.slice(portSeparatorIndex + 1);

    if (/^\d+$/.test(port)) {
      candidate = candidate.slice(0, portSeparatorIndex).trim();
    }
  }

  if (candidate.includes('%')) {
    candidate = candidate.split('%')[0]!.trim();
  }

  return isIP(candidate) ? candidate : null;
}

function parseForwardedHeader(headerValue: string | null): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const entries = headerValue.split(',');

  if (entries.length !== 1) {
    return undefined;
  }

  for (const directive of entries[0]!.split(';')) {
    const separatorIndex = directive.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = directive.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = directive.slice(separatorIndex + 1).trim();

    if (name !== 'for') {
      continue;
    }

    const candidate = normalizeIpCandidate(rawValue);

    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

function parseSingleHopXForwardedFor(
  headerValue: string | null
): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const parts = headerValue.split(',');

  if (parts.length !== 1) {
    return undefined;
  }

  const candidates = parts
    .map((part) => normalizeIpCandidate(part))
    .filter((value): value is string => Boolean(value));

  return candidates.length === 1 ? candidates[0] : undefined;
}

export function getClientIpAddress(
  source: ClientIpSource
): string | undefined {
  const headers = resolveHeaders(source);

  for (const headerName of DIRECT_IP_HEADERS) {
    const candidate = normalizeIpCandidate(headers.get(headerName) || '');

    if (candidate) {
      return candidate;
    }
  }

  const forwardedCandidate = parseForwardedHeader(headers.get('forwarded') || null);

  if (forwardedCandidate) {
    return forwardedCandidate;
  }

  return parseSingleHopXForwardedFor(headers.get('x-forwarded-for') || null);
}
