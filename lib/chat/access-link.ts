export function buildInvestorAccessPath(params?: {
  email?: string;
  reason?: 'session_required';
  next?: string;
}): string {
  const searchParams = new URLSearchParams();
  const normalizedEmail = params?.email?.trim().toLowerCase();

  if (normalizedEmail) {
    searchParams.set('email', normalizedEmail);
  }

  if (params?.reason) {
    searchParams.set('reason', params.reason);
  }

  if (isInvestorAccessNextPath(params?.next)) {
    searchParams.set('next', params.next);
  }

  const query = searchParams.toString();

  return query ? `/chat?${query}` : '/chat';
}

export function buildInvestorAccessUrl(
  baseUrl: string,
  email?: string,
  next?: string
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return `${normalizedBaseUrl}${buildInvestorAccessPath({ email, next })}`;
}

export function isInvestorAccessNextPath(value?: string | null): value is string {
  if (!value || typeof value !== 'string') {
    return false;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return false;
  }

  return value.startsWith('/agreement/');
}
