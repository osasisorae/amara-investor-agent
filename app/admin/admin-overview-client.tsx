'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AddInvestorButton } from '@/components/admin/AddInvestorButton';
import { AdminShell } from '@/components/admin/AdminShell';
import { AgentEfficiencyPanel } from '@/components/admin/AgentEfficiencyPanel';

interface AdminOverviewClientProps {
  adminEmail: string;
}

export default function AdminOverviewClient({
  adminEmail,
}: AdminOverviewClientProps) {
  const router = useRouter();
  const [metricsRefreshToken, setMetricsRefreshToken] = useState(0);

  const redirectToLogin = () => {
    router.push('/admin/login');
    router.refresh();
  };

  const handleUnauthorized = (response: Response) => {
    if (response.status !== 401) {
      return false;
    }

    redirectToLogin();
    return true;
  };

  return (
    <AdminShell
      adminEmail={adminEmail}
      activePage="overview"
      title="Amara Efficiency"
      description="Track how well Amara is moving investors through qualification, KYC, agreement, and payment without losing speed or creating avoidable human work."
    >
      <AgentEfficiencyPanel
        onUnauthorized={handleUnauthorized}
        refreshToken={metricsRefreshToken}
        embedded
        headerActions={
          <>
            <AddInvestorButton
              adminEmail={adminEmail}
              onUnauthorized={handleUnauthorized}
              onAdded={() => {
                setMetricsRefreshToken((current) => current + 1);
              }}
            />
            <Link
              href="/admin/pipeline"
              className="rounded-full border border-futurex-line px-4 py-2 text-sm font-medium text-futurex-muted transition hover:border-futurex-gold hover:text-futurex-gold"
            >
              Open Pipeline
            </Link>
          </>
        }
      />
    </AdminShell>
  );
}
