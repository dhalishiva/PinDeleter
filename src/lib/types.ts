// Row types for the tables/views the frontend reads (RLS restricts them to the current user).
import type { PlanId } from '@/config/site';

export type PinStatus = 'active' | 'queued' | 'deleted' | 'failed';
export type JobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'rate_limited'
  | 'completed'
  | 'cancelled'
  | 'failed';
export type ItemStatus = 'pending' | 'deleted' | 'failed' | 'skipped';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  notify_on_job_complete: boolean;
  free_deletions_used: number;
  plan: PlanId;
  plan_expires_at: string | null;
  created_at: string;
}

export interface Connection {
  id: string;
  user_id: string;
  pinterest_user_id: string;
  username: string;
  profile_image: string | null;
  account_type: string | null;
  scopes: string[];
  last_synced_at: string | null;
  status: 'active' | 'revoked' | 'error';
  last_error: string | null;
  created_at: string;
}

export interface BoardCount {
  board_id: string;
  pinterest_board_id: string;
  name: string;
  privacy: string | null;
  pin_count: number;
}

export interface Pin {
  id: string;
  connection_id: string;
  pinterest_pin_id: string;
  board_id: string | null;
  pinterest_board_id: string | null;
  board_name: string | null;
  title: string | null;
  description: string | null;
  link: string | null;
  link_domain: string | null;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  dominant_color: string | null;
  created_at_pinterest: string | null;
  is_owner: boolean;
  saves: number | null;
  clicks: number | null;
  impressions: number | null;
  engagement_fetched_at: string | null;
  status: PinStatus;
  sort_key: number | string;
}

export interface SyncRun {
  id: string;
  connection_id: string;
  status: 'running' | 'completed' | 'failed';
  phase: 'boards' | 'pins' | 'finalize' | 'done';
  boards_found: number;
  pins_fetched: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface DeleteJob {
  id: string;
  user_id: string;
  connection_id: string;
  parent_job_id: string | null;
  is_dry_run: boolean;
  status: JobStatus;
  total: number;
  deleted_count: number;
  failed_count: number;
  skipped_count: number;
  rate_limit_pauses: number;
  next_run_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface JobItem {
  id: string;
  job_id: string;
  pinterest_pin_id: string;
  status: ItemStatus;
  reason: string | null;
  attempts: number;
  last_http_status: number | null;
  last_error: string | null;
  processed_at: string | null;
  title: string | null;
  link: string | null;
  board_name: string | null;
  image_url: string | null;
  created_at_pinterest: string | null;
}

export interface JobEvent {
  id: string;
  job_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

export interface Payment {
  id: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  plan: PlanId;
  amount_cents: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface AppConfig {
  mockMode: boolean;
  freeLimit: number;
  paypalClientId: string | null;
  paypalEnv: 'sandbox' | 'live';
}
