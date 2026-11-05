# SmartDairy AI — API Reference

All API surfaces live on **Lovable Cloud** (managed Postgres + Auth + Storage + Edge Functions). Authentication is via Supabase JWT (Bearer token in `Authorization` header). Browser code uses the Supabase JS client which sets this header automatically.

Base URL for edge functions: `${VITE_SUPABASE_URL}/functions/v1/<function-name>`

## Auth

| Action | Method | How |
|---|---|---|
| Sign up | — | `supabase.auth.signUp({ email, password, options: { data: { full_name, farm_name }, emailRedirectTo } })` |
| Sign in | — | `supabase.auth.signInWithPassword({ email, password })` |
| Google | — | `lovable.auth.signInWithOAuth("google", { redirect_uri })` |
| Sign out | — | `supabase.auth.signOut()` |

A trigger on `auth.users` automatically creates a `profiles` row and assigns the `farmer` role.

## Tables (via Supabase JS client, RLS-enforced)

All tables are scoped to the calling user (admins can read all).

### `cattle`
Columns: `id`, `owner_id`, `tag`, `name`, `breed`, `age`, `gender`, `color`, `health_status`, `milk_yield`, `purchase_date`, `notes`, `image_url`, `created_at`, `updated_at`.

- List: `supabase.from("cattle").select("*")`
- Create: `supabase.from("cattle").insert({ owner_id: user.id, tag, name, breed, age, gender, ... })`
- Update: `supabase.from("cattle").update({ ... }).eq("id", id)`
- Delete: `supabase.from("cattle").delete().eq("id", id)`

### `milk_records`
Columns: `id`, `cattle_id`, `date`, `morning`, `evening`, `total` (generated), `notes`, `recorded_by`. Unique on `(cattle_id, date)`.

### `health_records`
Columns: `id`, `cattle_id`, `condition`, `treatment`, `vet_name`, `date`, `next_checkup`, `status` (`Scheduled`|`Upcoming`|`Overdue`|`Completed`), `created_by`.

### `breed_predictions`
Columns: `id`, `user_id`, `image_url`, `predicted_breed`, `confidence`, `reasoning`, `confirmed_breed`, `cattle_id`.

### `profiles`
Columns: `id` (= auth user id), `full_name`, `farm_name`, `phone`, `avatar_url`.

### `user_roles`
Columns: `id`, `user_id`, `role` (`admin`|`farmer`). Read-only for the user; admins can manage.

## Edge Functions

All require `Authorization: Bearer <jwt>`. CORS enabled for all origins.

### `POST /breed-recognition`
Identify cattle breed from an image URL using Lovable AI (Gemini vision).

Request body:
```json
{ "image_url": "https://.../signed-url" }
```
Responses:
- `200` `{ prediction_id, breed, confidence, reasoning }`
- `400` `{ error: "image_url is required" }`
- `401` `{ error: "Invalid token" }`
- `429` `{ error: "Too many requests, please try again shortly." }`
- `402` `{ error: "AI credits exhausted..." }`
- `502` `{ error: "AI gateway error" }`

Side effect: inserts a row into `breed_predictions`.

### `POST /confirm-breed`
Confirm or correct a prediction; optionally link to a cattle record (also updates that cattle's breed).

Request body:
```json
{ "prediction_id": "uuid", "confirmed_breed": "Gir", "cattle_id": "uuid|null" }
```
Responses:
- `200` `{ success: true, prediction: {...} }`
- `400` `{ error }` on invalid input
- `401` `{ error: "Invalid token" }`

### `GET /reports`
Aggregated dashboard data for the calling user.

Response shape:
```json
{
  "summary": {
    "total_cattle": 0,
    "healthy": 0, "at_risk": 0, "critical": 0,
    "active_alerts": 0,
    "today_milk": 0, "week_milk": 0, "month_milk": 0,
    "avg_per_cattle": 0
  },
  "health_distribution": [{ "name": "Healthy", "value": 0, "color": "..." }],
  "breed_distribution":  [{ "breed": "Gir", "count": 2 }],
  "daily_milk":          [{ "date": "2026-04-05", "total": 86.6 }],
  "alerts":              [{ "id": "...", "condition": "...", "next_checkup": "..." }]
}
```

### `POST /seed-demo-data`
One-click demo data loader. Idempotent: skips if user already has cattle.

Response: `{ success: true, cattle: 6 }` or `{ skipped: true, message: "..." }`.

## Storage

| Bucket | Purpose | Path convention |
|---|---|---|
| `cattle-images` (private) | Cattle photos | `{user_id}/{cattle_id}.{ext}` |
| `breed-uploads` (private) | AI input images | `{user_id}/{uuid}.{ext}` |

Browser usage:
```ts
await supabase.storage.from("breed-uploads").upload(path, file);
const { data } = await supabase.storage.from("breed-uploads").createSignedUrl(path, 3600);
```

RLS: users can only read/write inside `{their_user_id}/...`. Admins can read all.

## Security Model

- **Row-Level Security** enabled on every table; farmers see only their own data.
- **Roles** in a separate `user_roles` table (never on profiles) checked via `public.has_role(uid, role)` (SECURITY DEFINER).
- **Passwords** hashed by Supabase Auth (bcrypt).
- **Edge functions** verify JWT on every request and validate input (rejects unknown / oversized fields).
- **CORS** open for all origins; tighten via `Access-Control-Allow-Origin` if needed.
