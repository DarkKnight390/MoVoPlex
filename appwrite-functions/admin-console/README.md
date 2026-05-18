# MoVoPlex Admin Console Function

This function now uses **Cloudflare R2** as the primary object storage provider.

Implemented routes:

- `POST /movies`
- `PATCH /movies/:id`
- `DELETE /movies/:id`
- `POST /movies/:id/review`
- `POST /movies/:id/publish`
- `PATCH /creators/:id`
- `POST /categories`
- `PATCH /homepage`
- `POST /uploads/begin`
- `POST /uploads/complete`
- `POST /uploads/process`
- `POST /uploads/hls/complete`
- `POST /uploads/cancel`
- `POST /uploads/delete`
- `POST /media/sign`

## Upload flow

1. Save movie metadata in Appwrite.
2. Call `POST /uploads/begin`.
3. The function validates the admin caller through `admin_memberships`.
4. The function creates `movie_assets` and `processing_jobs` records.
5. The function presigns an R2 upload target.
6. The browser uploads directly to R2.
7. The browser calls `POST /uploads/complete`.
8. The backend marks the asset `uploaded` and queues processing.
9. Admin finalizes through `POST /uploads/process`.
10. For `main_video`, the function copies the original/master into `movoplex-videos/movies/{movieId}/original.mp4`.
11. A separate FFmpeg worker converts that original into HLS files in `movoplex-hls-streams/movies/{movieId}/`.
12. The worker calls `POST /uploads/hls/complete` with the generated manifest key.
13. The function stores the HLS manifest pointer in the existing `video_url` movie field, marks the HLS stream ready, and only then allows publish/playback.

Large movie uploads use multipart R2 uploads. Signed private delivery uses `POST /media/sign`.

## HLS playback contract

MoVoPlex does not play directly from `movoplex-videos`.

Storage roles:

```text
movoplex-temp-processing = browser upload landing bucket
movoplex-videos          = original/master MP4 source storage
movoplex-hls-streams     = playback-ready HLS stream storage
```

Expected object layout:

```text
movoplex-videos/
  movies/{movieId}/original.mp4

movoplex-hls-streams/
  movies/{movieId}/master.m3u8
  movies/{movieId}/1080p/index.m3u8
  movies/{movieId}/1080p/segment001.ts
  movies/{movieId}/720p/index.m3u8
  movies/{movieId}/720p/segment001.ts
```

After FFmpeg uploads the HLS files, register the manifest:

```powershell
$body = @{
  movie_id = "MOVIE_DOCUMENT_ID"
  manifest_key = "movies/MOVIE_DOCUMENT_ID/master.m3u8"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://cloud.appwrite.io/v1/functions/YOUR_ADMIN_CONSOLE_FUNCTION_ID/executions" `
  -Headers @{
    "X-Appwrite-Project" = "YOUR_PROJECT_ID"
    "Content-Type" = "application/json"
  } `
  -Body (@{
    path = "/uploads/hls/complete"
    method = "POST"
    body = $body
  } | ConvertTo-Json)
```

Use the equivalent Appwrite Functions execution call from your worker if it is not running in PowerShell.

## Entrypoint

- root: `appwrite-functions/admin-console`
- entrypoint: `src/main.js`

## Required Appwrite Function environment variables

```env
STORAGE_PROVIDER=r2

APPWRITE_DATABASE_ID=6a068aed002c9f86c207
APPWRITE_MOVIES_COLLECTION_ID=movies
APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID=admin_memberships
APPWRITE_MOVIE_ASSETS_COLLECTION_ID=movie_assets
APPWRITE_PROCESSING_JOBS_COLLECTION_ID=processing_jobs
APPWRITE_MOVIE_REVIEWS_COLLECTION_ID=movie_reviews
APPWRITE_CATEGORIES_COLLECTION_ID=categories
APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID=homepage_rows
APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID=homepage_row_items
APPWRITE_AUDIT_LOGS_COLLECTION_ID=audit_logs

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_TEMP_PROCESSING_BUCKET_NAME=movoplex-temp-processing
R2_VIDEOS_BUCKET_NAME=movoplex-videos
R2_HLS_STREAMS_BUCKET_NAME=movoplex-hls-streams
R2_TRAILERS_BUCKET_NAME=movoplex-trailers
R2_THUMBNAILS_BUCKET_NAME=movoplex-thumbnails
R2_SUBTITLES_BUCKET_NAME=movoplex-subtitles
R2_SIGNED_URL_TTL_SECONDS=3600
```

Appwrite injects runtime auth values automatically. No extra browser secret is needed for signed playback.

## Frontend environment

```env
VITE_STORAGE_PROVIDER=r2
VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID=your-admin-console-function-id
```

Optional direct/public bucket domains:

```env
VITE_R2_VIDEOS_BASE_URL=
VITE_R2_HLS_STREAMS_BASE_URL=
VITE_R2_THUMBNAILS_BASE_URL=
VITE_R2_TRAILERS_BASE_URL=
```

Leave those blank if you are using only signed private delivery.

## R2 checklist

1. Create the buckets listed above.
2. Create an R2 API token with Object Read & Write access.
3. Set the Appwrite Function env vars to the R2 values.
4. Redeploy the Appwrite function.
5. Keep `movoplex-temp-processing` private.
6. Keep `movoplex-videos` private and treat it as source/master storage only.
7. Store generated playback streams in `movoplex-hls-streams`.
8. Use `POST /media/sign` for private playback and image/trailer resolution.

## Appwrite schema update

The live `movies` collection is already at Appwrite's attribute limit, so do not add a new `hls_manifest_url` attribute. The platform uses the existing `video_url` field as the playback pointer, and that value must point to the HLS manifest in `movoplex-hls-streams`, not to the original MP4 in `movoplex-videos`.

Run this from the repo root after your Appwrite API env vars are set:

```powershell
npm run appwrite:init:console
```

The initializer is additive and will create missing attributes without deleting existing documents.

## Notes

- Existing legacy `b2://...` refs can still be signed through the fallback code path, but new uploads should use `r2://...`.
- Large movie uploads require the browser CORS policy on the temp bucket to allow multipart part uploads.
- If you previously stored public Backblaze bucket base URLs in `.env.local`, remove them or set `VITE_STORAGE_PROVIDER=r2`.


$env:NODE_OPTIONS='--use-system-ca'
npm run hls:auto:watch