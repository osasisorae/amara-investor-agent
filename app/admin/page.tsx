import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import AdminDashboardClient from './admin-dashboard-client';

export default async function AdminPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect('/admin/login');
  }

  return <AdminDashboardClient adminEmail={session.email} />;
}
