export function buildInvestorAccessPath(params?: {
  email?: string;
  reason?: 'session_required';
}): string {
  const searchParams = new URLSearchParams();
  const normalizedEmail = params?.email?.trim().toLowerCase();

  if (normalizedEmail) {
    searchParams.set('email', normalizedEmail);
  }

  if (params?.reason) {
    searchParams.set('reason', params.reason);
  }

  const query = searchParams.toString();

  return query ? `/chat?${query}` : '/chat';
}

export function buildInvestorAccessUrl(
  baseUrl: string,
  email?: string
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return `${normalizedBaseUrl}${buildInvestorAccessPath({ email })}`;
}
