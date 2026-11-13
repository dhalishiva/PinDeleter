import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Save, Trash2 } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Card, Input, Label, Skeleton, Switch } from '@/components/ui';
import { useProfile, useUpdateProfile } from '@/features/settings/hooks';
import { useAuth } from '@/features/auth/AuthProvider';
import { callFunction, errorMessage } from '@/lib/api';
import { dateStamp, downloadText } from '@/lib/download';
import { useUi } from '@/stores/ui';
import { toast } from '@/stores/ui';

export default function Settings() {
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useUi();
  const [name, setName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.display_name ?? '');
  }, [profile]);

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await callFunction<unknown>('account-export', {});
      downloadText(
        `pindeleter-export-${dateStamp()}.json`,
        JSON.stringify(data, null, 2),
        'application/json',
      );
      toast.success('Export downloaded');
    } catch (err) {
      toast.error('Export failed', errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await callFunction('account-delete', { confirm: 'DELETE' });
      await signOut();
      toast.success(
        'Your account was deleted',
        'All your data has been removed. Thanks for using PinDeleter.',
      );
      navigate('/', { replace: true });
    } catch (err) {
      toast.error('Could not delete your account', errorMessage(err));
      setDeleting(false);
    }
  };

  if (isLoading || !profile) return <Skeleton className="h-96" />;

  return (
    <>
      <Seo title="Settings" noindex path="/app/settings" />
      <h1 className="text-3xl sm:text-4xl">Settings</h1>
      <div className="mt-8 grid max-w-3xl gap-6">
        <Card className="p-6">
          <h2 className="text-xl">Profile</h2>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(
                { display_name: name.trim().slice(0, 80) || null },
                {
                  onSuccess: () => toast.success('Profile saved'),
                  onError: (err) => toast.error('Could not save', errorMessage(err)),
                },
              );
            }}
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email ?? ''} disabled readOnly />
            </div>
            <div>
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <Button type="submit" loading={update.isPending} icon={<Save className="h-4 w-4" aria-hidden />}>
              Save
            </Button>
          </form>
        </Card>

        <Card className="space-y-6 p-6">
          <h2 className="text-xl">Preferences</h2>
          <Switch
            id="theme"
            checked={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
            label="Dark mode"
            description="Light mode is the default. This only affects this browser."
          />
          <Switch
            id="notify"
            checked={profile.notify_on_job_complete}
            onChange={(v) =>
              update.mutate(
                { notify_on_job_complete: v },
                {
                  onSuccess: () => toast.success(v ? 'Emails on' : 'Emails off'),
                  onError: (err) => toast.error('Could not save', errorMessage(err)),
                },
              )
            }
            label="Email me when a job finishes"
            description="We always email you about payments and when a job needs your attention."
          />
        </Card>

        <Card className="p-6">
          <h2 className="text-xl">Your data</h2>
          <p className="mt-2 text-muted">
            Download a JSON file with your profile, connected-account details, jobs and payments. Tokens are
            never included.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={exportData}
            loading={exporting}
            icon={<Download className="h-4 w-4" aria-hidden />}
          >
            Export my data
          </Button>
        </Card>

        <Card className="border-2 border-danger/30 p-6">
          <h2 className="text-xl text-danger">Delete my account</h2>
          <p className="mt-2 text-muted">
            Disconnects all Pinterest accounts (deleting their tokens), deletes all your PinDeleter data and
            signs you out. Payment records are kept anonymously as required by tax law. Pins on Pinterest are
            not affected. This cannot be undone.
          </p>
          <Button
            className="mt-4"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            icon={<Trash2 className="h-4 w-4" aria-hidden />}
          >
            Delete my account
          </Button>
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="This permanently deletes your PinDeleter account and data."
      >
        <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
        <Input
          id="confirm-delete"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className="font-mono font-bold tracking-widest"
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            Keep my account
          </Button>
          <Button
            variant="danger"
            disabled={confirm.trim() !== 'DELETE'}
            loading={deleting}
            onClick={deleteAccount}
          >
            Delete forever
          </Button>
        </div>
      </Modal>
    </>
  );
}
