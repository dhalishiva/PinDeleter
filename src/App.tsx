import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MarketingLayout } from '@/layouts/MarketingLayout';
import { AppShell } from '@/layouts/AppShell';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import Home from '@/pages/marketing/Home';

const Pricing = lazy(() => import('@/pages/marketing/Pricing'));
const About = lazy(() => import('@/pages/marketing/About'));
const Contact = lazy(() => import('@/pages/marketing/Contact'));
const Faq = lazy(() => import('@/pages/marketing/Faq'));
const HowItWorks = lazy(() => import('@/pages/marketing/HowItWorks'));
const NotFound = lazy(() => import('@/pages/marketing/NotFound'));
const Privacy = lazy(() => import('@/pages/legal/Privacy'));
const Terms = lazy(() => import('@/pages/legal/Terms'));
const Refund = lazy(() => import('@/pages/legal/Refund'));
const Cookies = lazy(() => import('@/pages/legal/Cookies'));
const Disclaimer = lazy(() => import('@/pages/legal/Disclaimer'));
const Login = lazy(() => import('@/pages/auth/Login'));
const AuthCallback = lazy(() => import('@/pages/auth/AuthCallback'));
const Overview = lazy(() => import('@/pages/app/Overview'));
const PinterestCallback = lazy(() => import('@/pages/app/PinterestCallback'));
const Accounts = lazy(() => import('@/pages/app/Accounts'));
const SyncProgress = lazy(() => import('@/pages/app/SyncProgress'));
const Pins = lazy(() => import('@/pages/app/Pins'));
const Review = lazy(() => import('@/pages/app/Review'));
const Job = lazy(() => import('@/pages/app/Job'));
const Jobs = lazy(() => import('@/pages/app/Jobs'));
const Billing = lazy(() => import('@/pages/app/Billing'));
const Settings = lazy(() => import('@/pages/app/Settings'));

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

const s = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<Home />} />
          <Route path="pricing" element={s(<Pricing />)} />
          <Route path="about" element={s(<About />)} />
          <Route path="contact" element={s(<Contact />)} />
          <Route path="faq" element={s(<Faq />)} />
          <Route path="how-it-works" element={s(<HowItWorks />)} />
          <Route path="privacy" element={s(<Privacy />)} />
          <Route path="terms" element={s(<Terms />)} />
          <Route path="refund-policy" element={s(<Refund />)} />
          <Route path="cookies" element={s(<Cookies />)} />
          <Route path="disclaimer" element={s(<Disclaimer />)} />
          <Route path="login" element={s(<Login mode="login" />)} />
          <Route path="signup" element={s(<Login mode="signup" />)} />
          <Route path="auth/callback" element={s(<AuthCallback />)} />
          <Route path="*" element={s(<NotFound />)} />
        </Route>
        <Route path="app" element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={s(<Overview />)} />
            <Route path="connect/pinterest/callback" element={s(<PinterestCallback />)} />
            <Route path="accounts" element={s(<Accounts />)} />
            <Route path="accounts/:connectionId/sync" element={s(<SyncProgress />)} />
            <Route path="pins" element={s(<Pins />)} />
            <Route path="review" element={s(<Review />)} />
            <Route path="jobs" element={s(<Jobs />)} />
            <Route path="jobs/:jobId" element={s(<Job />)} />
            <Route path="billing" element={s(<Billing />)} />
            <Route path="settings" element={s(<Settings />)} />
            <Route path="*" element={s(<NotFound inApp />)} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
