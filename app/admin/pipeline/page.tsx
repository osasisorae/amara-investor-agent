import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import AdminPipelineClient from '../admin-dashboard-client';

export default async function AdminPipelinePage() {
  const session = await getAdminSession();

  if (!session) {
    redirect('/admin/login');
  }

  return <AdminPipelineClient adminEmail={session.email} />;
}
