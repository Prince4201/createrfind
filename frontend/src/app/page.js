import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return <LoginClient />;
}
