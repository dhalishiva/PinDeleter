import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import type { Profile } from '@/lib/types';
import { entitlementFor } from '@/lib/entitlement';
import { useAuth } from '@/features/auth/AuthProvider';

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profile,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, email, display_name, notify_on_job_complete, free_deletions_used, plan, plan_expires_at, created_at',
        )
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useEntitlement() {
  const profile = useProfile();
  return { ...profile, entitlement: profile.data ? entitlementFor(profile.data) : null };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'display_name' | 'notify_on_job_complete'>>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}
