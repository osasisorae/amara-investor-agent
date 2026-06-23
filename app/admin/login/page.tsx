import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import AdminLoginForm from './login-form';

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect('/admin');
  }

  return <AdminLoginForm />;
}
