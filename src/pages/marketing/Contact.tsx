import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Globe2, Mail, Building2, Send } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui';
import { SuccessIllustration } from '@/components/Illustrations';
import { callFunction, errorMessage } from '@/lib/api';
import { toast } from '@/stores/ui';
import { SITE } from '@/config/site';
import { PageHero } from './PageHero';

export const CONTACT_TOPICS = [
  'General question',
  'Billing & refunds',
  'Technical problem',
  'Privacy request',
  'Partnership',
  'Other',
] as const;

const schema = z.object({
  name: z.string().trim().min(1, 'Please tell us your name').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(200),
  topic: z.enum(CONTACT_TOPICS),
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters')
    .max(5000, 'Please keep it under 5,000 characters'),
  website: z.string().max(200).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function Contact() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { topic: 'General question', website: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await callFunction('contact-submit', values, { auth: false });
      setSent(true);
      reset();
    } catch (err) {
      toast.error('Message not sent', errorMessage(err));
    }
  };

  return (
    <>
      <Seo
        path="/contact"
        title="Contact"
        description="Get in touch with the PinDeleter team for support, billing, privacy requests or partnerships."
      />
      <PageHero eyebrow="Contact" title="We’d love to hear from you">
        Questions, feedback, refunds or privacy requests — we usually reply within 2 business days.
      </PageHero>
      <section className="pb-20">
        <div className="container-page grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="card p-6 sm:p-8">
            {sent ? (
              <div className="flex flex-col items-center py-8 text-center">
                <SuccessIllustration className="h-36 w-36" />
                <h2 className="mt-4 text-2xl">Message sent!</h2>
                <p className="mt-2 max-w-sm text-muted">
                  Thanks for writing. We’ve emailed you a copy and will reply soon.
                </p>
                <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby="name-error"
                      {...register('name')}
                    />
                    <FieldError id="name-error" message={errors.name?.message} />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      aria-describedby="email-error"
                      {...register('email')}
                    />
                    <FieldError id="email-error" message={errors.email?.message} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="topic">Topic</Label>
                  <Select id="topic" {...register('topic')}>
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    rows={6}
                    aria-invalid={!!errors.message}
                    aria-describedby="message-error"
                    {...register('message')}
                  />
                  <FieldError id="message-error" message={errors.message?.message} />
                </div>
                <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
                </div>
                <p className="text-xs text-muted">
                  We use your details only to answer your message. See our{' '}
                  <Link to="/privacy" className="font-bold text-violet hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  icon={<Send className="h-4 w-4" aria-hidden />}
                >
                  Send message
                </Button>
              </form>
            )}
          </div>
          <aside className="space-y-4">
            <div className="rounded-4xl bg-tint-violet p-6">
              <h2 className="text-lg">Business details</h2>
              <ul className="mt-4 space-y-3 text-[0.95rem]">
                <li className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 text-violet" aria-hidden />
                  <span>
                    <strong>{SITE.operator}</strong>
                    <br />
                    <span className="text-muted">Proprietor: {SITE.proprietor}</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 h-5 w-5 text-teal" aria-hidden />
                  <span>{SITE.address.country}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <a href={`mailto:${SITE.supportEmail}`} className="font-bold text-violet hover:underline">
                    {SITE.supportEmail}
                  </a>
                </li>
              </ul>
            </div>
            <div className="rounded-4xl bg-tint-sun p-6 text-sm text-ink/80">
              <p className="font-bold">Refund request?</p>
              <p className="mt-1">
                Choose “Billing &amp; refunds” and include your PayPal order ID from the Billing page.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
