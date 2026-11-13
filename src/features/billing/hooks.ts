import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import type { Payment } from '@/lib/types';
import { useAuth } from '@/features/auth/AuthProvider';

export function usePayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.payments,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          'id, paypal_order_id, paypal_capture_id, plan, amount_cents, currency, status, paid_at, refunded_at, created_at',
        )
        .neq('status', 'created')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
}
