# MoVoPlex

MoVoPlex is a Vite + React + TypeScript streaming frontend with:

- Appwrite for auth, admin data, and workflow state
- Cloudflare R2 (S3-compatible API) for media delivery
- React Query for client data access
- Tailwind CSS and shadcn/ui for the UI

## MoVoPlex Admin Console

The app now includes a nested `MoVoPlex Admin Console` under `/admin/*` with:

- dashboard metrics
- movie CRUD
- approval queue
- creator management
- upload management
- categories
- homepage controls
- audit logs
- shell routes for users, subscriptions, reports, revenue, payouts, storage, settings, and admin users

Admin routing is role-aware. Appwrite labels remain a coarse entry gate, while module permissions come from the `admin_memberships` collection.

## Setup

1. Install dependencies:

```sh
npm install
```

2. Copy `.env.example` to `.env.local`.

3. Fill in your Appwrite public values, R2 public base URLs, and the server-only bootstrap values you intend to use locally.

4. Start the app:

```sh
npm run dev
```

## Bootstrap Appwrite collections

The admin console expects a richer Appwrite schema than the original movie-only prototype.

Run:

```sh
npm run appwrite:init:console
```

This creates and syncs:

- `movies`
- `admin_memberships`
- `creator_profiles`
- `subscriber_profiles`
- `movie_assets`
- `processing_jobs`
- `movie_reviews`
- `categories`
- `homepage_rows`
- `homepage_row_items`
- `audit_logs`

Important behaviors:

- `movies`, `categories`, and homepage collections are readable by signed-in users
- admin-write collections are restricted to the configured admin label
- `audit_logs` is append-only at the collection-permission layer

## Bootstrap the first admin user

After collections exist, create the first admin account:

```sh
npm run appwrite:init:admin
```

This script:

- creates or updates the Appwrite user
- applies the `admin` label
- creates or updates the matching `admin_memberships` document
- assigns the configured admin role, defaulting to `super_admin`

If Node rejects your Appwrite TLS chain on Windows, run the bootstrap scripts with:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
```

## Required environment variables

```env
VITE_APPWRITE_ENDPOINT=
VITE_APPWRITE_PROJECT_ID=
VITE_APPWRITE_DATABASE_ID=
VITE_APPWRITE_MOVIES_COLLECTION_ID=movies
VITE_APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID=admin_memberships
VITE_APPWRITE_CREATOR_PROFILES_COLLECTION_ID=creator_profiles
VITE_APPWRITE_SUBSCRIBER_PROFILES_COLLECTION_ID=subscriber_profiles
VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID=movie_assets
VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID=processing_jobs
VITE_APPWRITE_MOVIE_REVIEWS_COLLECTION_ID=movie_reviews
VITE_APPWRITE_CATEGORIES_COLLECTION_ID=categories
VITE_APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID=homepage_rows
VITE_APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID=homepage_row_items
VITE_APPWRITE_AUDIT_LOGS_COLLECTION_ID=audit_logs
VITE_APPWRITE_ADMIN_LABEL=admin
VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID=

APPWRITE_API_KEY=
APPWRITE_ADMIN_USER_ID=movoplex-admin
APPWRITE_ADMIN_NAME=MoVoPlex Admin
APPWRITE_ADMIN_EMAIL=
APPWRITE_ADMIN_PASSWORD=
APPWRITE_ADMIN_ROLE=super_admin
APPWRITE_ADMIN_LABEL=admin

STORAGE_PROVIDER=r2
VITE_STORAGE_PROVIDER=r2
VITE_R2_PUBLIC_BASE_URL=
VITE_R2_VIDEOS_BASE_URL=
VITE_R2_THUMBNAILS_BASE_URL=
VITE_R2_TRAILERS_BASE_URL=
VITE_R2_PROFILE_ASSETS_BASE_URL=
VITE_R2_TEMP_PROCESSING_BASE_URL=
VITE_R2_SUBTITLES_BASE_URL=
VITE_R2_REPORTS_LOGS_BASE_URL=
VITE_R2_ORIGINALS_BASE_URL=
VITE_R2_DOWNLOADS_BASE_URL=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_S3_ENDPOINT=
```

## Admin function contract

Privileged admin writes are now routed through an Appwrite Function contract rather than direct browser mutations.

The client expects a deployed function ID in:

```env
VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID=
```

Current client contracts:

- `POST /movies`
- `PATCH /movies/:id`
- `DELETE /movies/:id`
- `POST /movies/:id/review`
- `POST /movies/:id/publish`
- `PATCH /creators/:id`
- `POST /categories`
- `POST /uploads/begin`
- `POST /uploads/complete`
- `PATCH /homepage`

The frontend is ready for this function-based write path. You still need to deploy the Appwrite Function implementation in your Appwrite project and bind it to the function ID above.

## Streaming access

Full streaming is no longer treated as universally open.

- subscribers need `subscription_status = active`
- admins can always access streaming
- approved or verified creators can access streaming operationally

Until Stripe lands, subscription status can be managed manually through Appwrite data and the upcoming subscription admin module.

## Cloudflare R2 bucket architecture

The app stores and resolves `r2://bucket/key` paths against these buckets:

- `movoplex-videos`
- `movoplex-thumbnails`
- `movoplex-trailers`
- `movoplex-profile-assets`
- `movoplex-temp-processing`
- `movoplex-subtitles`
- `movoplex-reports-logs`
- `movoplex-originals`
- `movoplex-downloads`

Recommended examples:

- `poster`: `r2://movoplex-thumbnails/movies/big-buck-bunny/poster.jpg`
- `banner`: `r2://movoplex-thumbnails/movies/big-buck-bunny/banner.jpg`
- `trailer`: `r2://movoplex-trailers/movies/big-buck-bunny/trailer.mp4`
- `video_url`: `r2://movoplex-videos/movies/big-buck-bunny/master.mp4`

Legacy `b2://` refs are still signed when Backblaze credentials are configured.

## Security note

Do not place Appwrite API keys or R2 secret keys in Vite client env vars.

- browser code should only receive public Appwrite config and public media URLs
- R2 `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` must remain server-side
- admin writes should stay function-backed so audit logging and permission checks are mandatory
