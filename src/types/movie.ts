
import { type MovieStatus, type RejectionReasonCode } from "./admin";

export interface Movie {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  description: string;
  rating: number;
  year: number;
  genre: string;
  duration: string;
  hls_manifest_url?: string;
  video_url?: string;
  banner?: string;
  trailer?: string;
  trailerUrl?: string;
  trailer_url?: string;
  previewUrl?: string;
  preview_url?: string;
  cast?: string;
  director?: string;
  language?: string;
  country?: string;
  age_rating?: string;
  status?: MovieStatus;
  creator_user_id?: string;
  revenue_share_percent?: number;
  release_date?: string | null;
  subscription_availability?: "free" | "subscriber_only" | "scheduled";
  featured_on_homepage?: boolean;
  category_ids?: string[];
  rejection_reason_code?: RejectionReasonCode | null;
  rejection_reason_note?: string | null;
}
