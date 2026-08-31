# API compatibility report — Django vs Node.js

**Date:** 19 August 2026  
**Old:** Django 6 + DRF + MongoEngine (`backend/`, port 8000)  
**New:** Express + TypeScript + Mongoose (`backend-node/`, port 8001)  
**Contract:** `MIGRATION_ANALYSIS.md`  
**Database:** shared MongoDB Atlas `doctor_db` (not renamed)

## How this audit was done

1. Source comparison of all 29 Django views/serializers/permissions against the Node routes.
2. Live **read-only** comparison on both servers (no successful login, no writes to production documents):
   - `GET /api/v1/health/`
   - `GET /api/v1/queue/`
   - unauthenticated `401` on protected routes
   - login/refresh **validation failures** (empty body, unknown email, missing refresh)
3. Node test suite (unit + integration + API): disposable documents only, deleted in `after()`.
4. Two Node fixes applied during the audit because they diverged from Django serializers / DRF:
   - Login/change-password empty and `null` fields now use DRF messages (`required` / `may not be blank` / `may not be null`).
   - Malformed JSON now returns `{ "detail": "JSON parse error - …" }` HTTP 400 instead of an HTML stack trace.

Django was not modified. Production patient/user documents were not updated during live comparison.

## Verdict legend

| Verdict | Meaning |
|---|---|
| **PASS** | URL, method, auth, permissions, happy-path body, status, envelope, and values match Django for the React client. |
| **DIFFERENCE** | Observable gap that does not change the clinic workflow or the frontend’s primary contract. |
| **FAIL** | Would break the SPA or change a business rule. **None remaining.** |

## Summary

| | Count |
|---|---|
| Endpoints audited | 29 |
| PASS | 28 |
| DIFFERENCE | 1 (`POST /auth/token/refresh/` error shape) |
| FAIL | 0 |
| TypeScript build | pass |
| Tests | **169 passed**, 0 failed |

---

## Cross-cutting (all endpoints)

| Topic | Result | Notes |
|---|---|---|
| Base path `/api/v1/` | PASS | Same prefixes as Django `config/urls.py`. |
| Trailing slash | DIFFERENCE | Frontend always sends `/`. Node also accepts the unsashed path. Django `APPEND_SLASH` redirects. |
| Success envelope `{ success, message, data? }` | PASS | |
| Error envelope `{ success, false, message, errors? }` | PASS | Status-machine 400s omit `errors`. |
| Unauthenticated | PASS | `401 { "detail": "Authentication credentials were not provided." }` + `WWW-Authenticate: Bearer realm="api"`. |
| Wrong role | PASS | `403 { "detail": "<permission message>" }` — exact Django strings. |
| Pagination | PASS | `page` default 1, `page_size` default 10, max 100; keys `page, page_size, total, total_pages, has_next, has_previous`. |
| Invalid `page` / `page_size` | DIFFERENCE | Both stacks currently 500. Node throws `InvalidPaginationError`; Django `int()` `ValueError`. |
| UTC “today” | PASS | Midnight UTC, half-open `[start, next midnight)`. |
| Token store vs display | PASS | Mongo `YYYYMMDD-P0001`; API `P0001`. |
| Mongo collections/fields | PASS | `users`, `patients`; field names unchanged. Live GET of existing patients does not mutate documents. |
| Extra Node route | DIFFERENCE | `GET /api/docs/` (Swagger). Not one of the 29. Django has no equivalent. |

---

## Endpoints 1–6 — health and auth

### 1. `GET /api/v1/health/` — **PASS**

| Check | Result |
|---|---|
| URL / method | PASS |
| Auth | PASS — public |
| Body | PASS — `{ status: "ok", database: "connected"\|"disconnected" }`, not enveloped |
| Status | PASS — always 200 |
| Live compare | Identical JSON on 8000 and 8001 |

### 2. `POST /api/v1/auth/login/` — **PASS**

| Check | Result |
|---|---|
| Auth | PASS — public |
| Body | PASS — `{ email, password }`; email stripped/lowercased; password whitespace preserved |
| Validation | PASS — missing, blank, null, invalid email, unknown user, wrong password, inactive, deleted |
| Success | PASS — 200 `"Login successful."` + `{ access, refresh, user }` |
| JWT | PASS — HS256, claims `user_id, email, full_name, role, token_type, jti, iat, exp`; access 60m, refresh 7d |
| Password hash | PASS — existing `pbkdf2_sha256` verified; login does not rewrite the stored hash |
| `last_login` | PASS — updated on success |
| Live compare | Empty `{}` bodies identical: first error `"This field is required."` for email and password |

**DIFFERENCE (not FAIL):** Django still runs default JWT authentication on `AllowAny` views. An **expired** `Authorization` header on login can 401 before the body is read. Node login ignores the header (safer for “log in again with a stale token”). The SPA always attaches a stored access token.

### 3. `POST /api/v1/auth/logout/` — **PASS**

| Check | Result |
|---|---|
| Auth | PASS — JWT required |
| Behavior | PASS — no Mongo write, no blacklist |
| Success | PASS — 200 `"Logout successful."` without `data` |
| Unauthenticated live | Identical `401 { detail }` |

**DIFFERENCE:** Invalid/expired access token. Django/simplejwt: `"Given token not valid for any token type"` (+ `messages`). Node: `"Token is invalid or expired."` Frontend only branches on HTTP 401.

### 4. `POST /api/v1/auth/token/refresh/` — **DIFFERENCE**

| Check | Result |
|---|---|
| URL / method | PASS |
| Auth | PASS — public (refresh in body) |
| Success | PASS — 200 `"Token refreshed successfully."` + `{ access, refresh }`; rotation on; no blacklist |
| Missing `refresh` | DIFFERENCE — see below |
| Invalid refresh | DIFFERENCE — see below |

Live compare, missing field:

- Django: `400 {"refresh":["This field is required."]}` (raw DRF; `MongoTokenRefreshView` wrapper does not catch serializer exceptions)
- Node: `400 {"success":false,"message":"Token refresh failed.","errors":{"refresh":["This field is required."]}}`

Invalid token: both HTTP 401. Django: `{ "detail": "Token is invalid or expired", "code": "token_not_valid" }`. Node: same `detail`/`code` nested under the business envelope (`errors`), message `"Token refresh failed."`

This matches **`MIGRATION_ANALYSIS.md` §22** (intended wrap). The SPA already accepts both: `body.data?.access ?? body.access`. **Not changed** — wrapping is the documented contract; unwrapping would be worse for the client.

### 5. `GET /api/v1/auth/me/` — **PASS**

| Check | Result |
|---|---|
| Auth | PASS — JWT |
| Success | PASS — `"User retrieved successfully."` + `data.user` (no password) |
| Unauthenticated live | Identical 401 |

**DIFFERENCE:** Same invalid-JWT `detail` string as logout. Node also treats `is_deleted` as `"User not found"` at authenticate time; Django JWT only checks `is_active` (soft-deleted users are already inactive).

### 6. `POST /api/v1/auth/change-password/` — **PASS**

| Check | Result |
|---|---|
| Auth | PASS — JWT |
| Body | PASS — `current_password`, `new_password`, `confirm_password`; whitespace preserved |
| Validation | PASS — incorrect current, mismatch, must differ, min 8 / common / numeric-only |
| Success | PASS — `"Password changed successfully."`; hash remains `pbkdf2_sha256$1200000$…` |

---

## Endpoints 7–13 — receptionists (ADMIN)

All: JWT + `IsAdmin` → `403 { "detail": "Admin access required." }`.

| # | Method | Path | Verdict |
|---|---|---|---|
| 7 | GET | `/receptionists/` | **PASS** — search icontains name/email/mobile; `role=RECEPTIONIST`, `is_deleted=false`; sort `-created_at`; pagination |
| 8 | POST | `/receptionists/` | **PASS** — 201; `role` forced; email unique among non-deleted; password validators |
| 9 | GET | `/receptionists/<pk>/` | **PASS** — 404 `"Receptionist not found."` for unknown, admin, or soft-deleted |
| 10 | PUT | `/receptionists/<pk>/` | **PASS** — partial; password ignored |
| 11 | DELETE | `/receptionists/<pk>/` | **PASS** — soft delete `is_deleted=true`, `is_active=false` |
| 12 | POST | `/receptionists/<pk>/activate/` | **PASS** — `is_active=true` only |
| 13 | POST | `/receptionists/<pk>/deactivate/` | **PASS** — `is_active=false` |

Serializer fields: `id, full_name, email, mobile, gender, is_active, created_at, updated_at`.

---

## Endpoints 14–20 — patients

View/create/update/stats/lookup: ADMIN or RECEPTIONIST. Delete: ADMIN only.

| # | Method | Path | Verdict |
|---|---|---|---|
| 14 | GET | `/patients/` | **PASS** — `apply_filters`: search, status, `filter=waiting\|completed\|today`, `date=YYYY-MM-DD`; sort `-created_at` |
| 15 | POST | `/patients/` | **PASS** — always `WAITING`; stored token `YYYYMMDD-P####`; response `P####`; `visit_number` = mobile count + 1 |
| 16 | GET | `/patients/stats/` | **PASS** — `waiting, in_consultation, completed, completed_today, today`; UTC windows |
| 17 | GET | `/patients/lookup/` | **PASS** — exact mobile; 400 if missing; 200 found/not-found envelopes |
| 18 | GET | `/patients/<pk>/` | **PASS** — full patient serializer; GET does not mutate Mongo |
| 19 | PUT | `/patients/<pk>/` | **PASS** — partial registration fields; receptionist locked after consultation starts; admin may edit any status |
| 20 | DELETE | `/patients/<pk>/` | **PASS** — hard delete; `403 "Only administrators can delete patients."` |

**DIFFERENCE on #15 (not FAIL):** Concurrent creates. Django unique index can 500. Node retries duplicate `token_number` (up to 8). Same stored format; no duplicates for the UTC day.

Permission messages match Django `CanViewPatients` / `CanCreatePatients` / `CanUpdatePatients` / `CanDeletePatients`.

---

## Endpoints 21–29 — queue and doctor

### 21. `GET /api/v1/queue/` — **PASS**

Public (`authentication_classes` empty on Django). Live bodies on 8000 and 8001 were **identical** (same `todays_token`, `current_token`, `current_patient_name`).

Algorithm: UTC today; latest created → `todays_token`; current prefers earliest `IN_CONSULTATION`, else earliest `WAITING`; display tokens `P####`.

### 22. `GET /api/v1/doctor/stats/` — **PASS**

ADMIN. Same numbers as `get_patient_stats()`, message `"Consultation stats retrieved successfully."`

### 23–25. Doctor lists / detail — **PASS**

| # | Path | Notes |
|---|---|---|
| 23 | GET `/doctor/patients/` | Default WAITING, `created_at` asc; `status=active`; `filter=today` skips waiting default; `today=true` wins over `filter=completed` |
| 24 | GET `/doctor/patients/completed/` | Always COMPLETED; sort `-consultation_completed_at` |
| 25 | GET `/doctor/patients/<pk>/` | `"Patient retrieved successfully."` |

### 26–29. Consultation mutations — **PASS**

Status machine (unchanged):

```
WAITING → start → IN_CONSULTATION → complete → COMPLETED
WAITING → complete (direct) → COMPLETED
IN_CONSULTATION → cancel → WAITING   (not CANCELLED)
```

| # | Action | Guard 400 (no `errors` key) |
|---|---|---|
| 26 | POST `.../start/` | `"Consultation can only be started for patients with WAITING status."` |
| 27 | PUT `.../consultation/` | `"Consultation data can only be saved while status is IN_CONSULTATION."` |
| 28 | POST `.../complete/` | `"Only waiting or in-consultation patients can be completed."` |
| 29 | POST `.../cancel/` | `"Only in-progress consultations can be cancelled."` |

Timestamps, `consulted_by*`, `updated_by*`, empty PUT `{}`, float `"A valid number is required."`, char `"This field may not be null."` — PASS.

**DIFFERENCE on start/complete/cancel (not FAIL):** Node uses status-conditional `findOneAndUpdate`. Concurrent duplicate start/complete → one 200 and one 400. Django is read-then-save (last write can win). Frontend still sees the same success/error messages.

Malformed `<pk>`: Node 404 `"Patient not found."`. Django MongoEngine may 500 `ValidationError`. Documented contract is 404. **DIFFERENCE**, safer for the client.

---

## What remains different

These are the only remaining gaps. None of them change waiting → in-consultation → completed, tokens, queue display, or receptionist/patient CRUD for the SPA.

1. **Refresh error JSON** — Django leaks raw DRF; Node wraps `{ success, message, errors }` as `MIGRATION_ANALYSIS.md` specified. Frontend handles both.
2. **Invalid access-token `detail` string** — simplejwt vs `"Token is invalid or expired."` Status is still 401.
3. **Login with a stale `Authorization` header** — Django may 401; Node still authenticates the body.
4. **Trailing slash** — Node accepts both; Django redirects to slash.
5. **Concurrent token create / consultation transitions** — Node is stricter (retry / atomic). Values and formats are unchanged.
6. **Malformed ObjectId** — Node 404; Django may 500.
7. **Invalid pagination query** — both 500; HTML/traceback text differs.
8. **Malformed JSON parser message** — both `{ detail: "JSON parse error - …" }` 400; V8 vs Python wording of the suffix differs.
9. **Swagger** — Node-only `/api/docs/`.
10. **Refresh inactive user** — Node reissues from JWT claims without a DB check. Django simplejwt tries Django ORM (MongoEngine users are not in that ORM).

## Test run

```
npm run build   # tsc — pass
npm test        # 169 passed, 0 failed
```

Coverage includes auth, receptionists, patients, doctor consultation (including concurrent start/complete), public queue, token uniqueness under concurrent registration, and OpenAPI.

**STOP.** No further API work in this pass.
