import { Models } from "appwrite";
import {
  type AdminRole,
  type AdminStatus,
  type AssetType,
  type AuditAction,
  type CreatorStatus,
  type EpisodeStatus,
  type MovieStatus,
  type ProcessingAssetStatus,
  type ProcessingJobStatus,
  type RejectionReasonCode,
  type ReviewDecision,
  type SeasonStatus,
  type SeriesStatus,
  type SubscriptionStatus,
} from "@/types/admin";

export type AppwriteUser = Models.User<Models.Preferences>;
export type AppwriteSession = Models.Session;

export type AppwriteMovieDocument = Models.Document & {
  title: string;
  poster: string;
  backdrop: string;
  description: string;
  rating: number;
  year: number;
  genre: string;
  duration: string;
  banner?: string | null;
  trailer?: string | null;
  trailerUrl?: string | null;
  trailer_url?: string | null;
  previewUrl?: string | null;
  preview_url?: string | null;
  cast?: string | null;
  director?: string | null;
  language?: string | null;
  country?: string | null;
  age_rating?: string | null;
  status: MovieStatus;
  creator_user_id?: string | null;
  revenue_share_percent?: number | null;
  release_date?: string | null;
  subscription_availability?: "free" | "subscriber_only" | "scheduled" | null;
  featured_on_homepage?: boolean | null;
  category_ids?: string[] | null;
  rejection_reason_code?: RejectionReasonCode | null;
  rejection_reason_note?: string | null;
  hls_manifest_url?: string | null;
  video_url?: string | null;
};

export type AppwriteSeriesDocument = Models.Document & {
  title: string;
  description: string;
  poster: string;
  banner?: string | null;
  genres?: string[] | null;
  language?: string | null;
  country?: string | null;
  age_rating?: string | null;
  creator_user_id?: string | null;
  status: SeriesStatus;
  release_schedule?: string | null;
  rating?: number | null;
};

export type AppwriteSeasonDocument = Models.Document & {
  series_id: string;
  season_number: number;
  title: string;
  description?: string | null;
  poster?: string | null;
  status: SeasonStatus;
};

export type AppwriteEpisodeDocument = Models.Document & {
  series_id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description?: string | null;
  runtime?: string | null;
  thumbnail?: string | null;
  trailer?: string | null;
  video_url?: string | null;
  status: EpisodeStatus;
  release_date?: string | null;
  published_at?: string | null;
};

export type AppwriteAdminMembershipDocument = Models.Document & {
  user_id: string;
  role: AdminRole;
  status: AdminStatus;
  display_name?: string | null;
  notes?: string | null;
};

export type AppwriteCreatorProfileDocument = Models.Document & {
  user_id: string;
  name: string;
  studio_name?: string | null;
  email: string;
  phone?: string | null;
  country?: string | null;
  verification_status: CreatorStatus;
  account_status: CreatorStatus;
  uploaded_movies?: number | null;
  total_watch_hours?: number | null;
  total_earnings?: number | null;
  payout_method?: string | null;
  created_date?: string | null;
};

export type AppwriteSubscriberProfileDocument = Models.Document & {
  user_id: string;
  subscription_status: SubscriptionStatus;
  payment_status?: string | null;
  access_expires_at?: string | null;
  watch_history_count?: number | null;
  support_ticket_count?: number | null;
};

export type AppwriteMovieAssetDocument = Models.Document & {
  movie_id?: string | null;
  series_id?: string | null;
  season_id?: string | null;
  asset_owner_type?: string | null;
  asset_type: AssetType;
  bucket: string;
  temp_key?: string | null;
  final_key?: string | null;
  processing_status: ProcessingAssetStatus;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_seconds?: number | null;
  language?: string | null;
  label?: string | null;
};

export type AppwriteEpisodeAssetDocument = Models.Document & {
  series_id: string;
  season_id: string;
  episode_id: string;
  asset_type: AssetType;
  bucket: string;
  temp_key?: string | null;
  final_key?: string | null;
  processing_status: ProcessingAssetStatus;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_seconds?: number | null;
  language?: string | null;
  label?: string | null;
};

export type AppwriteProcessingJobDocument = Models.Document & {
  movie_id?: string | null;
  series_id?: string | null;
  season_id?: string | null;
  episode_id?: string | null;
  entity_type?: string | null;
  job_type: string;
  status: ProcessingJobStatus;
  input_asset_id?: string | null;
  output_asset_id?: string | null;
  error_message?: string | null;
};

export type AppwriteMovieReviewDocument = Models.Document & {
  movie_id: string;
  reviewer_user_id: string;
  decision: ReviewDecision;
  checklist_video_quality?: boolean | null;
  checklist_poster_banner?: boolean | null;
  checklist_metadata?: boolean | null;
  checklist_copyright_rights?: boolean | null;
  checklist_age_rating?: boolean | null;
  checklist_subtitles?: boolean | null;
  rejection_reason_code?: RejectionReasonCode | null;
  rejection_reason_note?: string | null;
  publish_at?: string | null;
};

export type AppwriteSeriesReviewDocument = Models.Document & {
  series_id: string;
  reviewer_user_id: string;
  decision: ReviewDecision;
  rejection_reason_code?: RejectionReasonCode | null;
  rejection_reason_note?: string | null;
  publish_at?: string | null;
};

export type AppwriteEpisodeSubtitleDocument = Models.Document & {
  episode_id: string;
  language: string;
  asset_id?: string | null;
  label?: string | null;
  is_default?: boolean | null;
};

export type AppwriteProfileEpisodeWatchHistoryDocument = Models.Document & {
  user_id: string;
  episode_id: string;
  progress_seconds?: number | null;
  completed?: boolean | null;
  last_watched_at?: string | null;
};

export type AppwriteCategoryDocument = Models.Document & {
  name: string;
  slug: string;
  description?: string | null;
  is_system?: boolean | null;
};

export type AppwriteHomepageRowDocument = Models.Document & {
  name: string;
  slug: string;
  description?: string | null;
  is_featured_hero?: boolean | null;
  banner_image?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean | null;
};

export type AppwriteHomepageRowItemDocument = Models.Document & {
  row_id: string;
  movie_id: string;
  sort_order: number;
};

export type AppwriteAuditLogDocument = Models.Document & {
  actor_user_id: string;
  actor_name: string;
  actor_role: AdminRole;
  action: AuditAction;
  target_type: string;
  target_id: string;
  target_label?: string | null;
  old_value_json?: string | null;
  new_value_json?: string | null;
  ip_address?: string | null;
  request_id?: string | null;
  created_at: string;
};
