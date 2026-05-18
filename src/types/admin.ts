export const adminRoles = [
  "super_admin",
  "content_manager",
  "moderator",
  "finance_admin",
  "support_admin",
  "uploader",
  "read_only",
] as const;

export const adminStatuses = ["active", "suspended"] as const;

export const movieStatuses = [
  "draft",
  "uploading",
  "processing",
  "ready",
  "processing_failed",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "unpublished",
  "deleted",
] as const;

export const seriesStatuses = [
  "draft",
  "pending",
  "approved",
  "published",
  "unpublished",
] as const;

export const seasonStatuses = [
  "draft",
  "pending",
  "published",
  "unpublished",
] as const;

export const episodeStatuses = [
  "draft",
  "uploading",
  "processing",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "unpublished",
] as const;

export const creatorStatuses = [
  "pending",
  "approved",
  "verified",
  "suspended",
  "banned",
  "deleted",
] as const;

export const subscriptionStatuses = [
  "active",
  "inactive",
  "trial_not_used",
  "payment_failed",
  "cancelled",
  "banned",
] as const;

export const processingJobStatuses = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const processingAssetStatuses = [
  "pending",
  "uploaded",
  "processing",
  "ready",
  "failed",
] as const;

export const reviewDecisions = ["approved", "rejected"] as const;

export const rejectionReasonCodes = [
  "low_video_quality",
  "missing_poster",
  "copyright_issue",
  "incorrect_metadata",
  "inappropriate_content",
  "audio_problem",
  "subtitle_issue",
  "duplicate_upload",
] as const;

export const assetTypes = [
  "poster",
  "banner",
  "trailer",
  "main_video",
  "hls_stream",
  "subtitle",
  "series_poster",
  "series_banner",
  "season_poster",
  "episode_thumbnail",
  "episode_trailer",
  "episode_video",
  "episode_hls_stream",
  "episode_subtitle",
] as const;

export const payoutStatuses = [
  "pending",
  "approved",
  "paid",
  "failed",
] as const;

export const reportStatuses = [
  "open",
  "under_review",
  "resolved",
  "dismissed",
  "escalated",
] as const;

export const auditActions = [
  "movie_created",
  "movie_updated",
  "movie_deleted",
  "movie_reviewed",
  "movie_published",
  "movie_unpublished",
  "creator_updated",
  "upload_started",
  "upload_completed",
  "processing_completed",
  "processing_cancelled",
  "homepage_updated",
  "role_updated",
  "subscriber_updated",
  "processing_retried",
  "upload_deleted",
] as const;

export type AdminRole = (typeof adminRoles)[number];
export type AdminStatus = (typeof adminStatuses)[number];
export type MovieStatus = (typeof movieStatuses)[number];
export type SeriesStatus = (typeof seriesStatuses)[number];
export type SeasonStatus = (typeof seasonStatuses)[number];
export type EpisodeStatus = (typeof episodeStatuses)[number];
export type CreatorStatus = (typeof creatorStatuses)[number];
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export type ProcessingJobStatus = (typeof processingJobStatuses)[number];
export type ProcessingAssetStatus = (typeof processingAssetStatuses)[number];
export type ReviewDecision = (typeof reviewDecisions)[number];
export type RejectionReasonCode = (typeof rejectionReasonCodes)[number];
export type AssetType = (typeof assetTypes)[number];
export type AuditAction = (typeof auditActions)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type PayoutStatus = (typeof payoutStatuses)[number];

export type AdminCapability =
  | "dashboard.view"
  | "movies.view"
  | "movies.manage"
  | "movies.review"
  | "series.view"
  | "series.manage"
  | "series.review"
  | "uploads.view"
  | "uploads.manage"
  | "creators.view"
  | "creators.manage"
  | "homepage.view"
  | "homepage.manage"
  | "categories.view"
  | "categories.manage"
  | "reports.view"
  | "reports.manage"
  | "users.view"
  | "users.manage"
  | "subscriptions.view"
  | "subscriptions.manage"
  | "revenue.view"
  | "payouts.view"
  | "storage.view"
  | "settings.view"
  | "admin_users.view"
  | "admin_users.manage"
  | "audit_logs.view";

export const adminRoleCapabilities: Record<AdminRole, AdminCapability[]> = {
  super_admin: [
    "dashboard.view",
    "movies.view",
    "movies.manage",
    "movies.review",
    "series.view",
    "series.manage",
    "series.review",
    "uploads.view",
    "uploads.manage",
    "creators.view",
    "creators.manage",
    "homepage.view",
    "homepage.manage",
    "categories.view",
    "categories.manage",
    "reports.view",
    "reports.manage",
    "users.view",
    "users.manage",
    "subscriptions.view",
    "subscriptions.manage",
    "revenue.view",
    "payouts.view",
    "storage.view",
    "settings.view",
    "admin_users.view",
    "admin_users.manage",
    "audit_logs.view",
  ],
  content_manager: [
    "dashboard.view",
    "movies.view",
    "movies.manage",
    "movies.review",
    "series.view",
    "series.manage",
    "series.review",
    "uploads.view",
    "uploads.manage",
    "creators.view",
    "homepage.view",
    "homepage.manage",
    "categories.view",
    "categories.manage",
    "audit_logs.view",
  ],
  moderator: [
    "dashboard.view",
    "movies.view",
    "series.view",
    "reports.view",
    "reports.manage",
    "audit_logs.view",
  ],
  finance_admin: [
    "dashboard.view",
    "revenue.view",
    "payouts.view",
    "audit_logs.view",
  ],
  support_admin: [
    "dashboard.view",
    "users.view",
    "users.manage",
    "subscriptions.view",
    "subscriptions.manage",
    "audit_logs.view",
  ],
  uploader: [
    "dashboard.view",
    "movies.view",
    "movies.manage",
    "series.view",
    "series.manage",
    "uploads.view",
    "uploads.manage",
    "categories.view",
    "audit_logs.view",
  ],
  read_only: [
    "dashboard.view",
    "movies.view",
    "series.view",
    "creators.view",
    "homepage.view",
    "categories.view",
    "reports.view",
    "users.view",
    "subscriptions.view",
    "revenue.view",
    "payouts.view",
    "storage.view",
    "settings.view",
    "admin_users.view",
    "audit_logs.view",
  ],
};

export type AdminNavItem = {
  label: string;
  path: string;
  capability: AdminCapability;
  shell?: boolean;
};

export const adminSidebarItems: AdminNavItem[] = [
  { label: "Dashboard", path: "/admin/dashboard", capability: "dashboard.view" },
  { label: "Movies", path: "/admin/movies", capability: "movies.view" },
  { label: "Series", path: "/admin/series", capability: "series.view" },
  { label: "Approval Queue", path: "/admin/approval-queue", capability: "movies.review" },
  { label: "Creators", path: "/admin/creators", capability: "creators.view" },
  { label: "Users", path: "/admin/users", capability: "users.view", shell: true },
  { label: "Subscriptions", path: "/admin/subscriptions", capability: "subscriptions.view", shell: true },
  { label: "Uploads", path: "/admin/uploads", capability: "uploads.view" },
  { label: "Categories", path: "/admin/categories", capability: "categories.view" },
  { label: "Homepage", path: "/admin/homepage", capability: "homepage.view" },
  { label: "Reports", path: "/admin/reports", capability: "reports.view", shell: true },
  { label: "Revenue", path: "/admin/revenue", capability: "revenue.view", shell: true },
  { label: "Payouts", path: "/admin/payouts", capability: "payouts.view", shell: true },
  { label: "Storage", path: "/admin/storage", capability: "storage.view", shell: true },
  { label: "Settings", path: "/admin/settings", capability: "settings.view", shell: true },
  { label: "Admin Users", path: "/admin/admin-users", capability: "admin_users.view", shell: true },
  { label: "Audit Logs", path: "/admin/audit-logs", capability: "audit_logs.view" },
];

export const defaultHomepageRowNames = [
  "Featured Movies",
  "Trending Now",
  "New Releases",
  "MoVoPlex Originals",
  "Indie Spotlight",
  "Jamaican Cinema",
  "Caribbean Stories",
  "Documentaries",
  "Short Films",
  "Coming Soon",
];
