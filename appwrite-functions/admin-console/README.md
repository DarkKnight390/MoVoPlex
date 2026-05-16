# MoVoPlex Admin Console Function

This function now includes the real browser upload handshake for MoVoPlex media files.

Implemented routes today:

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
- `POST /uploads/cancel`
- `POST /uploads/delete`

The frontend now uses this function for both admin mutations and upload orchestration.

Upload flow:

1. Save movie metadata in Appwrite
2. Call `POST /uploads/begin`
3. Function validates the admin caller through `admin_memberships`
4. Function creates `movie_assets` and `processing_jobs` records
5. Function writes an `audit_logs` entry
6. Function authorizes against Backblaze and returns a live `upload_url` plus `authorization_token`
7. Browser uploads the selected file directly to Backblaze
8. Browser calls `POST /uploads/complete`
9. Function finalizes the uploaded temp object into the correct destination bucket
10. Function updates the asset/movie records, cleans up the temp file, and appends audit logs

## Folder layout

- `package.json`
- `src/main.js`

Use `src/main.js` as the Appwrite Function entrypoint.

## Required function environment variables

```env
APPWRITE_DATABASE_ID=6a068aed002c9f86c207
APPWRITE_MOVIES_COLLECTION_ID=movies
APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID=admin_memberships
APPWRITE_MOVIE_ASSETS_COLLECTION_ID=movie_assets
APPWRITE_PROCESSING_JOBS_COLLECTION_ID=processing_jobs
APPWRITE_AUDIT_LOGS_COLLECTION_ID=audit_logs

BACKBLAZE_KEY_ID=your-backblaze-key-id
BACKBLAZE_APPLICATION_KEY=your-backblaze-application-key
BACKBLAZE_TEMP_PROCESSING_BUCKET_ID=your-temp-processing-bucket-id
BACKBLAZE_TEMP_PROCESSING_BUCKET_NAME=movoplex-temp-processing
BACKBLAZE_VIDEOS_BUCKET_NAME=movoplex-videos
BACKBLAZE_TRAILERS_BUCKET_NAME=movoplex-trailers
BACKBLAZE_THUMBNAILS_BUCKET_NAME=movoplex-thumbnails
BACKBLAZE_SUBTITLES_BUCKET_NAME=movoplex-subtitles
```

Appwrite injects the runtime auth values used by the function automatically:

- `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- request header `x-appwrite-key`
- request header `x-appwrite-user-id`

## Frontend environment

Point the browser app at the deployed function:

```env
VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID=your-admin-console-function-id
```

## Important note

This function now covers the routes used by the current admin console screens:

- movie CRUD
- movie review / approval
- publish / unpublish
- creator status updates
- category save / update by slug
- homepage hero + row ordering
- upload begin / complete / process / cancel
- upload record cleanup / delete

It also filters writes to attributes that actually exist in the live Appwrite collections, which helps when your remote project has schema drift or hit Appwrite's attribute limit during earlier bootstraps.
