import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import { formatPrice, PLAN_MARKETING, PLANS, type PaidPlanId, type PlanId } from '@/config/site';
import { useAuth } from '@/features/auth/AuthProvider';
import { Checkout } from './Checkout';

const accents: Record<PlanId, string> = {
  free: 'from-[#767676] to-[#767676]',
  pass: 'from-[#E60023] via-[#E60023] to-[#E60023]',
  agency: 'from-[#111111] to-[#111111]',
};

interface Props {
  currentPlan?: PlanId | null;
  compact?: boolean;
  onPaid?: () => void;
  plans?: PlanId[];
}

export function PlanCards({ currentPlan, compact, onPaid, plans = ['free', 'pass', 'agency'] }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanId | null>(null);

  const choose = (id: PlanId) => {
    if (id === 'free') {
      navigate(user ? '/app' : '/signup');
      return;
    }
    if (!user) {
      navigate(`/signup?plan=${id}`);
      return;
    }
    setCheckoutPlan(id);
  };

  return (
    <>
      <div className={cn('grid gap-5', plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {plans.map((id, i) => {
          const plan = PLANS[id];
          const m = PLAN_MARKETING[id];
          const featured = !!m.highlight;
          const isCurrent = currentPlan === id && id !== 'free';
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'relative flex flex-col rounded-4xl border-2 bg-raised p-6 shadow-card transition hover:-translate-y-1 hover:shadow-lift',
                featured ? 'border-primary/60' : 'border-line',
              )}
            >
              {featured && (
                <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-sunset px-3 py-1 text-xs font-extrabold text-white shadow-glow">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> {m.highlight}
                </span>
              )}
              <div className={cn('mb-4 h-2 w-16 rounded-full bg-gradient-to-r', accents[id])} />
              <h3 className="text-xl">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{m.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight">{formatPrice(plan.priceCents)}</span>
                <span className="text-sm font-bold text-muted">
                  {id === 'free' ? 'forever' : 'USD · one-time'}
                </span>
              </p>
              {!compact && (
                <ul className="mt-5 flex-1 space-y-2.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[0.95rem]">
                      <span className="mt-0.5 rounded-full bg-teal-soft p-0.5">
                        <Check className="h-3.5 w-3.5 text-teal" aria-hidden />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-6 w-full"
                variant={featured ? 'primary' : id === 'agency' ? 'dark' : 'secondary'}
                onClick={() => choose(id)}
                disabled={id === 'free' && !!user && compact}
              >
                {isCurrent ? 'Extend by 30 days' : m.cta}
              </Button>
            </motion.div>
          );
        })}
      </div>
      <Modal
        open={!!checkoutPlan}
        onClose={() => setCheckoutPlan(null)}
        title="Checkout"
        description="Secure payment through PayPal. Your plan activates instantly."
      >
        {checkoutPlan && (
          <Checkout
            plan={checkoutPlan}
            onPaid={() => {
              setCheckoutPlan(null);
              onPaid?.();
            }}
          />
        )}
      </Modal>
    </>
  );
}
