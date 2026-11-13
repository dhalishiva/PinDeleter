import { Lock, Plug } from 'lucide-react';
import { Button } from '@/components/Button';
import { ConnectIllustration } from '@/components/Illustrations';
import { errorMessage } from '@/lib/api';
import { toast } from '@/stores/ui';
import { useStartConnect } from './hooks';

export function ConnectPrompt() {
  const connect = useStartConnect();
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-line bg-tint-pink px-6 py-12 text-center sm:px-12">
      <ConnectIllustration className="mx-auto h-36 w-52" />
      <h2 className="mt-6 text-3xl">Connect your Pinterest account</h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        You’ll approve access on Pinterest’s own page. We never see your password, and nothing is deleted
        until you review and confirm.
      </p>
      <Button
        size="lg"
        className="mt-8"
        loading={connect.isPending}
        icon={<Plug className="h-5 w-5" aria-hidden />}
        onClick={() =>
          connect.mutate(undefined, {
            onError: (e) => toast.error('Could not start connecting', errorMessage(e)),
          })
        }
      >
        Connect Pinterest
      </Button>
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Read boards & pins · delete pins you choose · read
        profile
      </p>
    </div>
  );
}
