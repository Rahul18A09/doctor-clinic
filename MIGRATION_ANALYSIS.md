# Django → Node.js Migration Analysis

**Source:** Python / Django 6.0.8 + Django REST Framework 3.17.1 + MongoEngine 0.29.3  
**Target:** Node.js + Express + TypeScript + Mongoose  
**Database:** Existing MongoDB Atlas database `doctor_db` (do **not** rename collections or fields)  
**Scope:** Read-only analysis of the current backend. No Python or MongoDB changes were made.

This document is the contract the Node rewrite must preserve so the existing React frontend (`frontend/src/api/*`) keeps working.

---

## Table of contents

1. [Django project structure](#1-django-project-structure)
2. [All API endpoints](#2-all-api-endpoints)
3. [HTTP methods](#3-http-methods)
4. [Request parameters](#4-request-parameters)
5. [Request body schemas](#5-request-body-schemas)
6. [Response schemas](#6-response-schemas)
7. [Authentication requirements](#7-authentication-requirements)
8. [Authorization / roles](#8-authorization--roles)
9. [JWT implementation](#9-jwt-implementation)
10. [Password hashing implementation](#10-password-hashing-implementation)
11. [MongoDB collections](#11-mongodb-collections)
12. [MongoDB document fields](#12-mongodb-document-fields)
13. [MongoDB indexes](#13-mongodb-indexes)
14. [Database queries](#14-database-queries)
15. [Business logic](#15-business-logic)
16. [Patient status transitions](#16-patient-status-transitions)
17. [Pagination](#17-pagination)
18. [Filtering](#18-filtering)
19. [Queue logic](#19-queue-logic)
20. [Statistics logic](#20-statistics-logic)
21. [Validation rules](#21-validation-rules)
22. [Error handling](#22-error-handling)
23. [Environment variables](#23-environment-variables)
24. [External dependencies](#24-external-dependencies)
25. [Node.js implementation notes](#25-nodejs-implementation-notes)

---

## 1. Django project structure

The backend lives in `backend/`. Django is used as an HTTP/auth framework only. There is **no relational database**. `DATABASES['default']` uses `django.db.backends.dummy`. All application data is in MongoDB via MongoEngine.

```
backend/
├── manage.py                          # CLI; auto-reexecs into .venv if needed
├── requirements.txt
├── .env / .env.example
├── .gitignore
├── config/                            # Django project package
│   ├── urls.py                        # Root URL router
│   ├── wsgi.py / asgi.py
│   ├── mongodb.py                     # MongoEngine Atlas connection manager
│   └── settings/
│       ├── __init__.py                # Loads .env; picks development|production
│       ├── base.py                    # Shared settings, JWT, CORS, DRF
│       ├── development.py             # DEBUG=True, console logging
│       └── production.py              # Security headers, SSL redirect
└── apps/
    ├── core/                          # Health check, response helpers, base document
    │   ├── apps.py                    # Connects MongoDB in AppConfig.ready()
    │   ├── documents.py               # TimestampedDocument (abstract)
    │   ├── responses.py               # success_response / error_response
    │   ├── urls.py / views.py
    │   └── models.py                  # Stub: "use documents.py"
    ├── users/                         # Auth + receptionist CRUD
    │   ├── documents.py               # User MongoEngine document
    │   ├── authentication.py          # MongoJWTAuthentication
    │   ├── permissions.py             # IsAdmin, IsReceptionist, IsAdminOrReceptionist
    │   ├── serializers.py             # Login, JWT, change-password
    │   ├── views.py / urls.py
    │   ├── receptionist_*.py
    │   ├── constants.py               # UserRole, Gender
    │   └── management/commands/
    │       ├── create_admin.py
    │       └── create_user.py
    └── patients/                      # Registration, doctor workflow, queue, stats
        ├── documents.py               # Patient MongoEngine document
        ├── views.py / urls.py         # Receptionist/admin patient CRUD
        ├── doctor_views.py / doctor_urls.py / doctor_serializers.py
        ├── queue.py / queue_views.py / queue_urls.py
        ├── stats.py / utils.py / permissions.py / constants.py
        └── management/commands/
            └── purge_soft_deleted_patients.py   # Legacy cleanup only
```

### Runtime bootstrap

1. `DJANGO_SETTINGS_MODULE=config.settings`
2. `config/settings/__init__.py` loads `.env` via `python-dotenv`, then imports `development` or `production` based on `DJANGO_ENV`
3. `apps.core.apps.CoreConfig.ready()` calls `MongoDBConnection.connect()`
4. Root URLconf: `config.urls` under prefix `/api/v1/`

### URL mounting (root)

| Prefix | Module |
|---|---|
| `/admin/` | Django admin (dummy DB — not used for app data) |
| `/api/v1/health/` | `apps.core.urls` |
| `/api/v1/auth/` | `apps.users.urls` |
| `/api/v1/receptionists/` | `apps.users.receptionist_urls` |
| `/api/v1/patients/` | `apps.patients.urls` |
| `/api/v1/queue/` | `apps.patients.queue_urls` |
| `/api/v1/doctor/stats/` | `DoctorConsultationStatsView` |
| `/api/v1/doctor/patients/` | `apps.patients.doctor_urls` |

### App roles (conceptual)

| App | Responsibility |
|---|---|
| `core` | Mongo connection, envelope responses, timestamps, health |
| `users` | Users collection, JWT login, receptionist management |
| `patients` | Patients collection, tokens/visits, queue, stats, doctor consultation |

There is **no `DOCTOR` role**. Clinic doctors authenticate as `ADMIN`.

Django `APPEND_SLASH` is default `True`. The frontend always uses trailing slashes. Preserve them in Express (or redirect).

---

## 2. All API endpoints

Base path: `/api/v1`

| # | Method | Path | View | Auth | Roles |
|---|---|---|---|---|---|
| 1 | GET | `/health/` | `HealthCheckView` | Public | — |
| 2 | POST | `/auth/login/` | `LoginView` | Public | — |
| 3 | POST | `/auth/logout/` | `LogoutView` | JWT | Any authenticated |
| 4 | POST | `/auth/token/refresh/` | `MongoTokenRefreshView` | Public (refresh token in body) | — |
| 5 | GET | `/auth/me/` | `CurrentUserView` | JWT | Any authenticated |
| 6 | POST | `/auth/change-password/` | `ChangePasswordView` | JWT | Any authenticated |
| 7 | GET | `/receptionists/` | `ReceptionistListCreateView` | JWT | ADMIN |
| 8 | POST | `/receptionists/` | `ReceptionistListCreateView` | JWT | ADMIN |
| 9 | GET | `/receptionists/<pk>/` | `ReceptionistDetailView` | JWT | ADMIN |
| 10 | PUT | `/receptionists/<pk>/` | `ReceptionistDetailView` | JWT | ADMIN |
| 11 | DELETE | `/receptionists/<pk>/` | `ReceptionistDetailView` | JWT | ADMIN |
| 12 | POST | `/receptionists/<pk>/activate/` | `ReceptionistActivateView` | JWT | ADMIN |
| 13 | POST | `/receptionists/<pk>/deactivate/` | `ReceptionistDeactivateView` | JWT | ADMIN |
| 14 | GET | `/patients/` | `PatientListCreateView` | JWT | ADMIN, RECEPTIONIST |
| 15 | POST | `/patients/` | `PatientListCreateView` | JWT | ADMIN, RECEPTIONIST |
| 16 | GET | `/patients/stats/` | `PatientStatsView` | JWT | ADMIN, RECEPTIONIST |
| 17 | GET | `/patients/lookup/` | `PatientLookupView` | JWT | ADMIN, RECEPTIONIST |
| 18 | GET | `/patients/<pk>/` | `PatientDetailView` | JWT | ADMIN, RECEPTIONIST |
| 19 | PUT | `/patients/<pk>/` | `PatientDetailView` | JWT | ADMIN, RECEPTIONIST |
| 20 | DELETE | `/patients/<pk>/` | `PatientDetailView` | JWT | ADMIN only |
| 21 | GET | `/queue/` | `PublicQueueStatusView` | Public (auth classes empty) | — |
| 22 | GET | `/doctor/stats/` | `DoctorConsultationStatsView` | JWT | ADMIN |
| 23 | GET | `/doctor/patients/` | `DoctorPatientListView` | JWT | ADMIN |
| 24 | GET | `/doctor/patients/completed/` | `DoctorCompletedPatientListView` | JWT | ADMIN |
| 25 | GET | `/doctor/patients/<pk>/` | `DoctorPatientDetailView` | JWT | ADMIN |
| 26 | POST | `/doctor/patients/<pk>/start/` | `DoctorStartConsultationView` | JWT | ADMIN |
| 27 | PUT | `/doctor/patients/<pk>/consultation/` | `DoctorSaveConsultationView` | JWT | ADMIN |
| 28 | POST | `/doctor/patients/<pk>/complete/` | `DoctorCompleteConsultationView` | JWT | ADMIN |
| 29 | POST | `/doctor/patients/<pk>/cancel/` | `DoctorCancelConsultationView` | JWT | ADMIN |

`<pk>` is the MongoDB ObjectId hex string of the document (`str(instance.id)`).

There is no PATCH, no file upload, no WebSocket, and no registration/signup endpoint for admins (admins are created via `manage.py create_admin` / `create_user`).

---

## 3. HTTP methods

| Method | Used for |
|---|---|
| GET | Reads, lists, stats, lookup, public queue, health |
| POST | Login, logout, refresh, change password, create receptionist/patient, activate/deactivate, start/complete/cancel consultation |
| PUT | Update receptionist, update patient registration, save consultation notes (all PUTs are **partial** — every field is optional) |
| DELETE | Soft-delete receptionist; hard-delete patient |
| OPTIONS | Allowed by CORS |
| PATCH | Not implemented |

CORS allows: `DELETE, GET, OPTIONS, PATCH, POST, PUT`.

---

## 4. Request parameters

All list/filter params are query strings. Path params are ObjectIds.

### Path parameters

| Param | Endpoints | Format |
|---|---|---|
| `pk` | receptionist detail/activate/deactivate; patient detail; doctor patient actions | 24-char Mongo ObjectId string |

### Query parameters — `GET /receptionists/`

| Param | Default | Rules |
|---|---|---|
| `page` | `1` | `max(int(page), 1)` |
| `page_size` | `10` | clamped to `[1, 100]` |
| `search` | `""` | case-insensitive contains on `full_name`, `email`, `mobile` |

### Query parameters — `GET /patients/`

| Param | Default | Rules |
|---|---|---|
| `page` | `1` | `max(int(page), 1)` |
| `page_size` | `10` | clamped to `[1, 100]` |
| `search` | `""` | icontains on `patient_name`, `mobile`, `token_number` |
| `status` | `""` | if value is in `WAITING \| IN_CONSULTATION \| COMPLETED \| CANCELLED`, filter by exact status. Takes precedence over `filter` |
| `filter` | `""` | `waiting` → WAITING; `completed` → COMPLETED; `today` → UTC calendar day on `created_at`. Ignored for status if `status` is valid |
| `date` | `""` | `YYYY-MM-DD`. Inclusive start / exclusive next day on `created_at`. Invalid dates are **silently ignored**. Takes precedence over `filter=today` |

### Query parameters — `GET /patients/lookup/`

| Param | Required | Rules |
|---|---|---|
| `mobile` | yes | stripped string; 400 if missing/blank |

### Query parameters — `GET /doctor/patients/`

| Param | Default | Rules |
|---|---|---|
| `page` | `1` | same as above |
| `page_size` | `10` | clamped to `[1, 100]` |
| `search` | `""` | icontains on `patient_name`, `mobile`, `token_number` |
| `status` | `""` | `active` → `{WAITING, IN_CONSULTATION}`; else exact status if in CHOICES. If omitted **and** `filter` is empty or `waiting`, default is **WAITING only** |
| `today` | `""` | `true` / `1` / `yes` (case-insensitive) → UTC today on `created_at` |
| `filter` | `""` | `waiting` (or empty, with no status) → WAITING; `today` → all statuses for UTC today (does **not** force WAITING); `completed` → COMPLETED (all time unless `today` also set) |

### Query parameters — `GET /doctor/patients/completed/`

| Param | Default | Rules |
|---|---|---|
| `page` | `1` | same |
| `page_size` | `10` | `[1, 100]` |
| `search` | `""` | icontains on name, mobile, token |

### No query params

Health, auth (except refresh body), receptionist mutate, patient mutate, doctor mutate, stats, public queue.

**Implementation trap:** `int(page)` / `int(page_size)` throw if the value is non-numeric. Django currently lets that become a 500. Match or harden in Node; do not change the happy-path contract.

---

## 5. Request body schemas

All bodies are JSON (`Content-Type: application/json`). No multipart.

### `POST /auth/login/`

```json
{
  "email": "string (email)",
  "password": "string (write-only, whitespace preserved)"
}
```

Email is stripped and lowercased during validation.

### `POST /auth/logout/`

Empty body is fine. JWT required in `Authorization` header. Server does **not** read or blacklist tokens.

### `POST /auth/token/refresh/`

```json
{
  "refresh": "string (JWT refresh token)"
}
```

### `POST /auth/change-password/`

```json
{
  "current_password": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

### `POST /receptionists/`

```json
{
  "full_name": "string, max 255, required",
  "email": "string, email, required, stored lowercased",
  "mobile": "string, max 20, required",
  "password": "string, write-only, required",
  "confirm_password": "string, write-only, required",
  "gender": "MALE | FEMALE | OTHER, required"
}
```

Created user always has `role=RECEPTIONIST`, `is_active=true`, `is_deleted=false`.

### `PUT /receptionists/<pk>/`

All fields optional (partial update despite PUT):

```json
{
  "full_name": "string, max 255",
  "email": "string, email, lowercased",
  "mobile": "string, max 20",
  "gender": "MALE | FEMALE | OTHER"
}
```

Password cannot be changed here.

### `POST /receptionists/<pk>/activate/` and `/deactivate/`

No body. State is set in the view.

### `POST /patients/`

```json
{
  "patient_name": "string, max 255, required",
  "mobile": "string, max 20, required, stripped",
  "age": "integer, 0–150, required",
  "gender": "MALE | FEMALE | OTHER, required",
  "blood_group": "A+|A-|B+|B-|AB+|AB-|O+|O-, optional, allow blank",
  "address": "string, optional, allow blank",
  "chief_complaint": "string, required, stripped"
}
```

Server-generated on create (not accepted from client): `token_number`, `visit_number`, `status=WAITING`, `created_by`, `created_by_name`.

### `PUT /patients/<pk>/`

All fields optional. Same types as create. Receptionist may only update when `status === WAITING`. Admin may update any status. This endpoint does **not** accept consultation fields or status.

### `PUT /doctor/patients/<pk>/consultation/`

All fields optional:

```json
{
  "temperature": "number | null",
  "blood_pressure": "string, max 20, allow blank",
  "pulse": "string, max 20, allow blank",
  "weight": "number | null",
  "height": "number | null",
  "diagnosis": "string, allow blank",
  "doctor_notes": "string, allow blank",
  "prescription": "string, allow blank"
}
```

Only allowed when `status === IN_CONSULTATION`. Sets `updated_by` / `updated_by_name`.

### `POST /doctor/patients/<pk>/start|complete|cancel/`

No body.

---

## 6. Response schemas

### Envelope (application endpoints)

Success (`apps.core.responses.success_response`):

```json
{
  "success": true,
  "message": "string",
  "data": { }
}
```

`data` is omitted when there is nothing to return (logout, change-password, delete).

Error (`error_response`):

```json
{
  "success": false,
  "message": "string",
  "errors": { }
}
```

`errors` is omitted when not provided. When present it is typically DRF serializer error maps: `{ "field": ["msg"] }`.

### Health (not enveloped)

`GET /health/` returns raw:

```json
{
  "status": "ok",
  "database": "connected" | "disconnected"
}
```

Always HTTP 200 if the process is up, even when Mongo is down.

### DRF auth/permission failures (not enveloped)

Unauthenticated / bad JWT / inactive user:

```json
{ "detail": "…" }
```

HTTP 401. Header: `WWW-Authenticate: Bearer …`

Forbidden (wrong role):

```json
{ "detail": "Admin access required." }
```

HTTP 403. Message depends on the permission class (see §8).

**The Node API must keep both shapes:** enveloped business errors vs DRF-style `detail` for 401/403, unless the frontend is updated in the same migration.

### Shared user object (`UserSerializer`)

Returned under `data.user` for login and `/auth/me/`:

```json
{
  "id": "ObjectId string",
  "full_name": "string",
  "email": "string",
  "role": "ADMIN | RECEPTIONIST",
  "is_active": true,
  "last_login": "ISO-8601 | null",
  "created_at": "ISO-8601 | null",
  "updated_at": "ISO-8601 | null"
}
```

Does **not** include `mobile`, `gender`, `password`, or `is_deleted`.

### Login `200`

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "access": "<JWT>",
    "refresh": "<JWT>",
    "user": { /* UserSerializer */ }
  }
}
```

### Token refresh `200`

```json
{
  "success": true,
  "message": "Token refreshed successfully.",
  "data": {
    "access": "<JWT>",
    "refresh": "<JWT>"
  }
}
```

`refresh` is always present because `ROTATE_REFRESH_TOKENS = True`.

### Logout `200`

```json
{ "success": true, "message": "Logout successful." }
```

### Change password `200`

```json
{ "success": true, "message": "Password changed successfully." }
```

### Receptionist object (`ReceptionistSerializer`)

```json
{
  "id": "string",
  "full_name": "string",
  "email": "string",
  "mobile": "string (empty string if null)",
  "gender": "string (empty string if null)",
  "is_active": true,
  "created_at": "ISO-8601 | null",
  "updated_at": "ISO-8601 | null"
}
```

`role` is not included (always receptionist in this resource).

### Paginated receptionist list `200`

```json
{
  "success": true,
  "message": "Receptionists retrieved successfully.",
  "data": {
    "results": [ /* ReceptionistSerializer[] */ ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 0,
      "total_pages": 1,
      "has_next": false,
      "has_previous": false
    }
  }
}
```

Create receptionist: `201`, `{ data: { receptionist }, message: "Receptionist created successfully." }`  
Get/update/activate/deactivate: `{ data: { receptionist }, message: "…" }`  
Delete: `{ success: true, message: "Receptionist deleted successfully." }` (no data)

### Patient object (`PatientSerializer`)

```json
{
  "id": "string",
  "token_number": "P0001",
  "visit_number": 1,
  "patient_name": "string",
  "mobile": "string",
  "age": 0,
  "gender": "MALE | FEMALE | OTHER",
  "blood_group": "string ('' if null)",
  "address": "string",
  "chief_complaint": "string",
  "status": "WAITING | IN_CONSULTATION | COMPLETED | CANCELLED",
  "created_by": "user ObjectId string",
  "created_by_name": "string",
  "created_at": "ISO-8601 | null",
  "updated_at": "ISO-8601 | null",
  "completed_at": "ISO-8601 | null",
  "is_editable_by_receptionist": true,
  "is_editable_by_admin": true,
  "doctor_notes": "string",
  "diagnosis": "string",
  "prescription": "string",
  "temperature": "number | null",
  "blood_pressure": "string",
  "pulse": "string",
  "weight": "number | null",
  "height": "number | null",
  "consultation_started_at": "ISO-8601 | null",
  "consultation_completed_at": "ISO-8601 | null",
  "consulted_by": "string",
  "consulted_by_name": "string",
  "updated_by": "string",
  "updated_by_name": "string"
}
```

Notes:

- `token_number` in **responses** is display format (`P0001`), not the stored value (`YYYYMMDD-P0001`). See §19.
- `completed_at` is `completed_at || consultation_completed_at`.
- `is_editable_by_receptionist` is `status === WAITING`.
- `is_editable_by_admin` is always `true`.
- Null strings are serialized as `""`. Numeric vitals stay `null` if unset.

Paginated patient lists use the same `results` + `pagination` shape as receptionists.

Create patient: `201`, `{ data: { patient }, message: "Patient registered successfully." }`  
Patient delete: `{ success: true, message: "Patient deleted successfully." }`

### Lookup `200` — not found

```json
{
  "success": true,
  "message": "No previous visits found for this mobile number.",
  "data": {
    "found": false,
    "mobile": "…",
    "visit_count": 0,
    "next_visit_number": 1
  }
}
```

### Lookup `200` — found

```json
{
  "success": true,
  "message": "Returning patient found.",
  "data": {
    "found": true,
    "mobile": "…",
    "visit_count": 3,
    "next_visit_number": 4,
    "patient": {
      "patient_name": "string",
      "age": 0,
      "gender": "string",
      "blood_group": "string",
      "address": "string"
    }
  }
}
```

Pre-fill uses the **latest** visit by `created_at`. `visit_count` is total documents with that mobile.

### Stats (`GET /patients/stats/` and `GET /doctor/stats/`)

Same payload, different message:

```json
{
  "success": true,
  "message": "Patient stats retrieved successfully.",
  "data": {
    "waiting": 0,
    "in_consultation": 0,
    "completed": 0,
    "completed_today": 0,
    "today": 0
  }
}
```

Doctor message: `"Consultation stats retrieved successfully."`

### Public queue `GET /queue/`

```json
{
  "success": true,
  "message": "Queue status retrieved successfully.",
  "data": {
    "todays_token": "P0007",
    "current_token": "P0003",
    "current_patient_name": "string"
  }
}
```

Empty clinic day: all strings `""`.

### HTTP status codes used

| Code | When |
|---|---|
| 200 | Success (including login) |
| 201 | Receptionist or patient created |
| 400 | Validation / illegal status transition / missing mobile |
| 401 | Missing/invalid/expired JWT, inactive user |
| 403 | Authenticated but wrong role |
| 404 | Receptionist or patient not found |
| 500 | JWT generation failure on login; unhandled exceptions |

---

## 7. Authentication requirements

### Global DRF defaults

```
DEFAULT_AUTHENTICATION_CLASSES = MongoJWTAuthentication
DEFAULT_PERMISSION_CLASSES = IsAuthenticated
```

Views override these as needed.

### Header

```
Authorization: Bearer <access_token>
```

`AUTH_HEADER_TYPES = ("Bearer",)`.

### Public endpoints (no JWT)

- `GET /health/`
- `POST /auth/login/`
- `POST /auth/token/refresh/` (`authentication_classes = ()`, `permission_classes = ()`)
- `GET /queue/` (`authentication_classes = []`, `permission_classes = [AllowAny]`)

### JWT-required

Everything else.

### User resolution

`MongoJWTAuthentication.get_user`:

1. Read claim `user_id` from the token
2. `User.objects.get(id=user_id)`
3. If missing → 401 `"User not found"`
4. If `is_active` is false → 401 `"User is inactive"`
5. Does **not** separately check `is_deleted` (soft-deleted users already have `is_active=false`)

### Logout semantics

Logout is **client-side only**. The view returns success and does nothing to Mongo or the token. The frontend discards access/refresh tokens. There is **no blacklist**. Stolen tokens remain valid until expiry.

### Login side effects

On success: `user.last_login = utcnow()` then `save()` (also bumps `updated_at` via `TimestampedDocument.save`).

---

## 8. Authorization / roles

### Roles (only two)

```python
ADMIN = "ADMIN"
RECEPTIONIST = "RECEPTIONIST"
```

Stored as uppercase strings on `users.role`. Admin **is** the doctor. There is no third role.

### Permission matrix

| Resource | ADMIN | RECEPTIONIST | Anonymous |
|---|---|---|---|
| Health / public queue / login / refresh | yes | yes | yes |
| `/auth/me/`, change-password, logout | yes | yes | no |
| Receptionist CRUD, activate/deactivate | yes | 403 | 401 |
| List/create/view/update patients | yes | yes | 401 |
| Delete patient | yes | 403 `"Only administrators can delete patients."` | 401 |
| Patient stats / lookup | yes | yes | 401 |
| All `/doctor/*` routes | yes | 403 `"Admin access required."` | 401 |

### Extra object-level rules (not DRF permissions)

- Receptionist **update** of a patient is rejected in the serializer if `status != WAITING` with message: `"Patient registration cannot be edited after consultation has started."`
- Admin can edit registration fields at any status.
- Consultation start/save/complete/cancel have status-machine checks (see §16).

### Soft-deleted receptionists

List/get/update/activate/deactivate queries always include `is_deleted=False`. Soft-deleted users disappear from the admin UI and cannot log in.

---

## 9. JWT implementation

Library: `djangorestframework-simplejwt` 5.5.1 + `PyJWT` 2.13.0.

### Settings (`config/settings/base.py` + simplejwt defaults)

| Setting | Value |
|---|---|
| Algorithm | `HS256` |
| Signing key | Django `SECRET_KEY` |
| Access lifetime | `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` (default **60**) |
| Refresh lifetime | `JWT_REFRESH_TOKEN_LIFETIME_DAYS` (default **7**) |
| Rotate refresh tokens | **True** |
| Blacklist after rotation | **False** (`token_blacklist` app is **not** installed) |
| Auth header type | `Bearer` |
| User id field | `id` |
| User id claim | `user_id` |
| Token type claim | `token_type` |
| JTI claim | `jti` |

### Issuance

`MongoTokenObtainPairSerializer.get_token(user)` builds a **refresh** token via `Token.for_user`, then adds custom claims. Access is derived from `refresh.access_token`.

`user_id` is `str(user.id)` (Mongo ObjectId hex).

### Access token payload

```json
{
  "token_type": "access",
  "exp": 0,
  "iat": 0,
  "jti": "uuid",
  "user_id": "<ObjectId hex>",
  "email": "user@example.com",
  "full_name": "…",
  "role": "ADMIN | RECEPTIONIST"
}
```

(`jti` on access is newly generated; refresh `jti`/`exp`/`token_type` are not copied.)

### Refresh token payload

Same custom claims, `token_type: "refresh"`, longer `exp`.

### Refresh behavior

`POST /auth/token/refresh/` with `{ "refresh" }`:

- Validates refresh JWT
- Returns new access **and** new refresh (rotation)
- Old refresh is **not** stored or revoked (blacklist disabled). In practice both old and new refresh tokens work until they expire. Preserve this unless you intentionally add a denylist.

### Node must match

- Same `SECRET_KEY`
- HS256
- Claim names `user_id`, `token_type`, `jti`, `exp`, `iat`
- Custom claims `email`, `full_name`, `role` on both tokens
- Access 60 minutes, refresh 7 days (env-overridable)
- Frontend stores `data.access` and `data.refresh` and sends `Bearer`

---

## 10. Password hashing implementation

Django’s `make_password` / `check_password` (`django.contrib.auth.hashers`).

### Algorithm

Default hasher in Django 6.0.8:

- Class: `PBKDF2PasswordHasher`
- Algorithm id: `pbkdf2_sha256`
- Iterations: **1,200,000**
- Digest: SHA-256
- DK length: 64 bytes, then Base64
- Salt: random string from Django’s `RANDOM_STRING_CHARS`

Stored format:

```
pbkdf2_sha256$1200000$<salt>$<base64-hash>
```

Example shape (not a real hash):

```
pbkdf2_sha256$1200000$abcSalt12$<64-byte-b64>
```

Existing Mongo `users.password` values **must keep working**. Node must verify this Django string, not re-hash all users with bcrypt on day one (unless you migrate hashes on successful login).

### Where hashing is applied

| Action | Method |
|---|---|
| `User.set_password(raw)` | `make_password` |
| `User.check_password(raw)` | `check_password` |
| Create receptionist | `set_password` then save |
| Change password | `set_password` then save |
| `create_admin` / `create_user` management commands | `set_password` |

Passwords are never returned in APIs (`write_only` / omitted from serializers).

### Password validators (create receptionist + change password)

Django `AUTH_PASSWORD_VALIDATORS`:

1. `UserAttributeSimilarityValidator` — too similar to user attributes (often a no-op here because `validate_password(value)` is called **without** a user instance)
2. `MinimumLengthValidator` — **min 8 characters** (default, no OPTIONS override)
3. `CommonPasswordValidator` — rejects common passwords
4. `NumericPasswordValidator` — rejects all-numeric passwords

Login does **not** run these validators; it only checks the hash.

### Change-password extra rules

- `current_password` must match
- `new_password === confirm_password`
- `new_password !== current_password`

---

## 11. MongoDB collections

Database name: `DATABASE_NAME` env, default **`doctor_db`**.

| Collection | Document class | Purpose |
|---|---|---|
| `users` | `apps.users.documents.User` | Admins and receptionists |
| `patients` | `apps.patients.documents.Patient` | Visits / tokens / consultations |

No other application collections. No MongoEngine `signals`, no GridFS, no sessions collection in Mongo.

Django dummy DB is unused. `psycopg2-binary` in `requirements.txt` is unused leftover.

---

## 12. MongoDB document fields

All timestamps are **naive UTC** (`datetime.datetime.utcnow()`), stored as BSON dates. `TimestampedDocument.save()` always sets `updated_at = utcnow()`.

Mongo `_id` is ObjectId. APIs expose it as `id` string.

### `users`

| Field | Type | Constraints | Default |
|---|---|---|---|
| `_id` | ObjectId | PK | auto |
| `full_name` | string | required, max 255 | — |
| `email` | string (email) | required, **unique** | — |
| `password` | string | required, max 256 (Django hash) | — |
| `mobile` | string | max 20 | unset / null |
| `gender` | string | `MALE \| FEMALE \| OTHER` | unset |
| `role` | string | required, `ADMIN \| RECEPTIONIST` | `RECEPTIONIST` |
| `is_active` | bool | | `true` |
| `is_deleted` | bool | | `false` |
| `last_login` | datetime | | unset |
| `created_at` | datetime | | utcnow |
| `updated_at` | datetime | | utcnow on every save |

### `patients`

`meta.strict = False` — extra legacy keys (e.g. old `is_deleted`) are tolerated and ignored by MongoEngine.

| Field | Type | Constraints | Default |
|---|---|---|---|
| `_id` | ObjectId | PK | auto |
| `token_number` | string | required, **unique**, max 20 | generated `YYYYMMDD-P####` |
| `visit_number` | int | required, min 1 | `1` (actually `count(mobile)+1`) |
| `patient_name` | string | required, max 255 | — |
| `mobile` | string | required, max 20 | — |
| `age` | int | required, 0–150 | — |
| `gender` | string | required, max 20 | — |
| `blood_group` | string | max 5 | unset |
| `address` | string | | unset |
| `chief_complaint` | string | required | — |
| `status` | string | required, see §16 | `WAITING` |
| `created_by` | string | required | creator user id |
| `created_by_name` | string | | creator full name |
| `doctor_notes` | string | | unset |
| `diagnosis` | string | | unset |
| `prescription` | string | | unset |
| `temperature` | float | | unset |
| `blood_pressure` | string | max 20 | unset |
| `pulse` | string | max 20 | unset |
| `weight` | float | | unset |
| `height` | float | | unset |
| `consultation_started_at` | datetime | | unset / null on cancel |
| `consultation_completed_at` | datetime | | unset |
| `completed_at` | datetime | | unset (set equal to completed_at on complete) |
| `consulted_by` | string | user id | unset |
| `consulted_by_name` | string | | unset |
| `updated_by` | string | | unset |
| `updated_by_name` | string | | unset |
| `created_at` | datetime | | utcnow |
| `updated_at` | datetime | | utcnow on save |

There are **no MongoDB references / DBRefs**. User links are plain strings.

Patients are **hard-deleted**. Users (receptionists) are **soft-deleted**.

---

## 13. MongoDB indexes

Declared in MongoEngine `meta["indexes"]` plus unique constraints on fields.

### `users`

| Index | Unique | Fields |
|---|---|---|
| `_id_` | yes | `_id` |
| email unique | yes | `email` (`EmailField(unique=True)`) |
| `email_1` (also listed in meta) | no (may overlap unique) | `email` |
| `role_1` | no | `role` |
| `is_deleted_1` | no | `is_deleted` |

### `patients`

| Index | Unique | Fields |
|---|---|---|
| `_id_` | yes | `_id` |
| token unique | yes | `token_number` |
| `token_number_1` (also in meta) | overlap | `token_number` |
| `visit_number_1` | no | `visit_number` |
| `mobile_1` | no | `mobile` |
| `status_1` | no | `status` |
| `created_at_1` | no | `created_at` |

**Do not drop unique indexes on `users.email` or `patients.token_number`.**  
Node/Mongoose schemas should declare the same indexes. Do not invent new unique indexes (e.g. unique mobile would break returning patients).

No compound indexes are declared. Queue and “today” queries would benefit from `{ created_at: 1, status: 1 }` but that is an optional later optimization — not required for behavioral parity.

---

## 14. Database queries

All queries are MongoEngine querysets. Equivalent Mongo filters for Mongoose:

### Users / auth

| Operation | Query |
|---|---|
| Login lookup | `findOne({ email: /^email$/i })` then fallback exact `email` |
| JWT load user | `findById(user_id)` |
| Email exists (create) | `{ email: /^email$/i, is_deleted: false }` |
| Email exists (update) | same plus `{ _id: { $ne: excludeId } }` |
| List receptionists | `{ role: "RECEPTIONIST", is_deleted: false }` + optional `$or` regex search |
| Get receptionist | `{ _id: pk, role: "RECEPTIONIST", is_deleted: false }` |
| Soft delete | `{ is_deleted: true, is_active: false }` |
| Activate / deactivate | set `is_active` |
| Admin exists (`create_admin`) | `{ role: "ADMIN" }` |

Search regex: case-insensitive contains on `full_name`, `email`, `mobile`. Sort: `{ created_at: -1 }`. Skip/limit pagination.

### Patients — list / detail

| Operation | Query |
|---|---|
| List | `{}` then filters (§18) |
| Get / update / delete | `{ _id: pk }` — **no** status/deleted filter |
| Create | `insert` with generated token/visit |

### Token generation (`generate_token_number`)

1. `today_start, today_end` = UTC midnight .. next midnight
2. `find({ created_at: { $gte: today_start, $lt: today_end } }, { token_number: 1 })`
3. Parse max sequence (see §19)
4. Return `YYYYMMDD-P####`

**Not atomic.** Concurrent creates can collide; unique index on `token_number` will throw. Node should retry on duplicate key.

### Visit number / lookup

```
find({ mobile }).sort({ created_at: -1 }).limit(1)   // latest
countDocuments({ mobile })                             // visit_count
next_visit_number = visit_count + 1
```

Mobile is exact match after strip (not regex, not normalized to digits-only).

### Doctor lists

See §18. Ordering:

- `status=IN_CONSULTATION` → `consultation_started_at` descending
- `status=COMPLETED` → `consultation_completed_at` descending
- otherwise → `created_at` **ascending** (queue order)

Completed list: `{ status: "COMPLETED" }`, sort `consultation_completed_at` descending.

### Queue

See §19.

### Stats

See §20.

### Management commands (not HTTP)

- `create_admin` / `create_user`: insert into `users`
- `purge_soft_deleted_patients`: `deleteMany({ is_deleted: true })` then `$unset is_deleted` on remaining — legacy only

---

## 15. Business logic

### Clinic workflow (end-to-end)

1. Receptionist or admin registers a patient → `WAITING`, daily token, visit number from mobile history
2. Lookup-by-mobile prefills name/age/gender/blood_group/address for returning patients
3. Public `/queue/` shows last token issued today and who is currently being seen
4. Admin (doctor) starts consultation → `IN_CONSULTATION`
5. Admin saves vitals/notes (repeatable PUT)
6. Admin completes → `COMPLETED` (can skip start and complete directly from WAITING)
7. Admin can cancel an in-progress consult → back to `WAITING` (not `CANCELLED`)
8. Receptionist can edit registration only while WAITING
9. Admin can delete a patient document entirely
10. Admin manages receptionist accounts (create, edit, soft-delete, activate/deactivate)

### Token numbers

Stored: `YYYYMMDD-P0001` (UTC date of `created_at` day + sequence).  
API/UI: `P0001` via `format_token_for_display`.

Search still matches the **stored** `token_number` (`token_number__icontains`). Searching `P0001` can match; searching only `0001` also can. Searching the date prefix can match stored form.

### Visit numbers

Per mobile, incrementing count of patient **documents** (each registration is a new document / visit). Changing mobile on update does **not** recompute `visit_number`.

### Created/consulted/updated audit fields

Stored as strings, not refs:

- Create: `created_by`, `created_by_name`
- Start consult (and complete-from-waiting): `consulted_by`, `consulted_by_name`
- Save consult / complete: `updated_by`, `updated_by_name`
- Cancel: does **not** clear `consulted_by*`

### Timezone

All “today” windows use **UTC midnight**, not clinic local time. `TIME_ZONE = "UTC"`. If the clinic is IST (UTC+5:30), a visit at 1:00 AM IST counts as the previous UTC day. Preserve this unless product wants a change.

### Django admin

`/admin/` is mounted but models are not registered and the DB backend is dummy. Ignore for Node.

---

## 16. Patient status transitions

Constants:

```
WAITING
IN_CONSULTATION
COMPLETED
CANCELLED
```

### State machine actually implemented

```
                register
                   │
                   ▼
               WAITING ◄──────────────────┐
               │     │                    │
        start  │     │ complete           │ cancel
               │     │ (direct)           │
               ▼     │                    │
        IN_CONSULTATION ──────────────────┘
               │
               │ complete
               ▼
            COMPLETED
```

### Transition table

| From | Action | To | Extra writes | Guard |
|---|---|---|---|---|
| *(new)* | POST `/patients/` | WAITING | token, visit, created_by* | auth create |
| WAITING | POST `.../start/` | IN_CONSULTATION | `consultation_started_at=now`, `consulted_by*` | else 400 `"Consultation can only be started for patients with WAITING status."` |
| IN_CONSULTATION | PUT `.../consultation/` | IN_CONSULTATION | vitals/notes, `updated_by*` | else 400 `"Consultation data can only be saved while status is IN_CONSULTATION."` |
| WAITING | POST `.../complete/` | COMPLETED | sets `consultation_started_at`, `consulted_by*`, `consultation_completed_at`, `completed_at`, `updated_by*` all to now | — |
| IN_CONSULTATION | POST `.../complete/` | COMPLETED | `consultation_completed_at`, `completed_at`, `updated_by*`; keeps existing start/consulted_by | — |
| IN_CONSULTATION | POST `.../cancel/` | **WAITING** | `consultation_started_at = null` | else 400 `"Only in-progress consultations can be cancelled."` |
| COMPLETED / CANCELLED | complete | 400 | `"Only waiting or in-consultation patients can be completed."` | |

### Important: `CANCELLED` is unused

`PatientStatus.CANCELLED` is in CHOICES and can be used as a **filter** if such documents exist, but **no current code path sets `status = CANCELLED`**. Cancel returns the patient to the waiting queue.

Preserve this behavior (cancel ≠ cancelled).

### Editability

- Receptionist PUT registration: only WAITING
- Admin PUT registration: always
- DELETE patient: admin, any status, hard delete

---

## 17. Pagination

Custom, **not** DRF `PageNumberPagination` (the DRF `PAGE_SIZE = 20` setting is unused).

### Formula (identical on receptionist list, patient list, doctor list, completed list)

```
page      = max(int(page, 1), 1)
page_size = min(max(int(page_size, 10), 1), 100)
total     = count(queryset)
total_pages = max(ceil(total / page_size), 1)
skip      = (page - 1) * page_size
results   = queryset.skip(skip).limit(page_size)
has_next  = page < total_pages
has_previous = page > 1
```

Default `page_size` is **10**, max **100**.

If `page` is past the last page, `results` is `[]` but `pagination.page` still echoes the requested page; `total_pages` is at least 1 even when `total` is 0.

Response key is always `data.results` + `data.pagination` (not DRF’s `count`/`next`/`previous`).

---

## 18. Filtering

### Receptionists

Always: `role=RECEPTIONIST AND is_deleted=false`.  
Optional `search`: OR icontains on name, email, mobile.  
Sort: `-created_at`.

### Patients (`GET /patients/`) — `apply_filters`

Applied in order:

1. `search` → OR icontains `patient_name`, `mobile`, `token_number`
2. Status:
   - if `status` ∈ CHOICES → exact status
   - else if `filter=waiting` → WAITING
   - else if `filter=completed` → COMPLETED
   - else no status filter (all statuses)
3. Date:
   - if `date=YYYY-MM-DD` valid → that UTC day on `created_at`
   - else if `filter=today` → UTC today on `created_at`
   - invalid `date` is ignored (and does not fall through to today)

Sort: `-created_at`.

### Doctor patients (`GET /doctor/patients/`) — `apply_doctor_filters`

1. `search` — same OR icontains
2. Status:
   - `status=active` → WAITING **or** IN_CONSULTATION
   - else if `status` ∈ CHOICES → exact
   - else if `filter` is empty **or** `filter=waiting` → **WAITING** (default)
   - `filter=today` does **not** apply the waiting default
3. Date / completed:
   - if `today` in `{true,1,yes}` **or** `filter=today` → UTC today on `created_at`
   - else if `filter=completed` → COMPLETED (all-time)

Default doctor list (no query params) = **WAITING only**, sorted by `created_at` ascending.

### Completed list

Always `status=COMPLETED`, optional search, sort `-consultation_completed_at`.

Search is Mongo regex icontains; it is not token-display-aware and not digit-normalized for mobile.

---

## 19. Queue logic

Public, unauthenticated: `GET /api/v1/queue/` → `get_public_queue_status()`.

### Day window

UTC `[today 00:00:00, tomorrow 00:00:00)`.

### `todays_token`

Latest patient **created today** (`sort created_at desc`). Display-format token, or `""`.

### `current_token` / `current_patient_name`

1. Prefer today’s patient with `status=IN_CONSULTATION`, ordered by `consultation_started_at` then `created_at` (earliest first)
2. Else today’s earliest `WAITING` by `created_at` (queue head)
3. Else empty strings

Completed patients drop out automatically, so the display advances P0005 → P0006 → …

Cancelled-back-to-waiting patients re-enter the waiting queue in their original `created_at` order.

### Display formatter (`format_token_for_display`)

| Stored | Display |
|---|---|
| `20260819-P0007` | `P0007` |
| `P0007` (legacy) | `P0007` |
| empty | `""` |

If suffix after `-P` does not start with `P`, prefix `P`.

### Sequence generator (`generate_token_number`)

Prefix: `{YYYYMMDD}-P`  
Scan today’s patients:

- If token starts with that prefix, parse trailing digits
- Else if token is `P` + digits (legacy), use that number
- Next = `max + 1`, zero-padded to 4 digits: `YYYYMMDD-P0001`

Sequence **resets each UTC day**. Uniqueness is global because of the date prefix + unique index.

---

## 20. Statistics logic

Shared function `get_patient_stats()` used by:

- `GET /patients/stats/` (admin + receptionist)
- `GET /doctor/stats/` (admin only)

Same numbers, different message.

UTC today window as elsewhere.

| Key | Meaning |
|---|---|
| `waiting` | count `status=WAITING` (all-time, not just today) |
| `in_consultation` | count `status=IN_CONSULTATION` (all-time) |
| `completed` | count `status=COMPLETED` (all-time) |
| `completed_today` | `status=COMPLETED` **and** `consultation_completed_at` in UTC today |
| `today` | count with `created_at` in UTC today (any status) |

`completed_today` uses `consultation_completed_at`, not `created_at` or `completed_at`. Completing a yesterday-registered patient increments `completed_today` but not `today`.

No aggregation pipeline — five separate `count()` queries. Fine to keep or collapse into one `$facet` as long as numbers match.

---

## 21. Validation rules

### Enums

**Gender:** `MALE`, `FEMALE`, `OTHER`  
**Blood group:** `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`  
**Role:** `ADMIN`, `RECEPTIONIST`  
**Patient status:** `WAITING`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`

### Auth

| Field | Rules |
|---|---|
| Login email | valid email; lookup iexact; 400 `"No account found with email '{email}'."` |
| Login password | exact; 400 `"Incorrect password."` |
| Inactive | 400 `{ non_field_errors: ["This account has been deactivated."] }` |
| Deleted | 400 `{ non_field_errors: ["This account no longer exists."] }` |
| New password | Django validators (min 8, not common, not numeric-only) |
| Confirm | must match new |
| Current vs new | must differ |

Login error `message` is the **first** serializer error string (not a generic label).

### Receptionists

| Field | Create | Update |
|---|---|---|
| full_name | required, max 255, stripped on write | optional, stripped |
| email | required, unique among non-deleted (iexact), stored lower | optional, unique excluding self |
| mobile | required, max 20, stripped | optional, stripped |
| gender | required, enum | optional, enum |
| password / confirm | required, match, validators | not accepted |

Duplicate email message: `"A user with this email already exists."`

### Patients

| Field | Create | Update |
|---|---|---|
| patient_name | required, max 255, stripped | optional, stripped |
| mobile | required, max 20, stripped (no digit/length regex) | optional, stripped |
| age | required int 0–150 | optional 0–150 |
| gender | required enum | optional enum |
| blood_group | optional enum or blank | optional |
| address | optional, stripped | optional, stripped |
| chief_complaint | required, stripped | optional, stripped |

No uniqueness on mobile. No phone E.164 validation.

### Consultation save

All optional. Strings stripped. Floats may be null. `blood_pressure` / `pulse` max 20.

### ObjectId

Invalid/unknown `pk` → 404 `"Receptionist not found."` or `"Patient not found."`  
MongoEngine `DoesNotExist` (invalid ObjectId typically also DoesNotExist).

---

## 22. Error handling

### Application envelope (intended)

Views catch `serializer.is_valid() == False` and return:

```
HTTP 400
{ success: false, message: <first list error or fallback>, errors: serializer.errors }
```

Fallbacks: `"Validation failed."`, `"Login failed."`, `"Password change failed."`

Status-machine failures use `message` only (no `errors` key).

Not-found: HTTP 404, `{ success: false, message: "…" }`.

Login JWT build failure: HTTP 500, `{ success: false, message: "Token generation failed: {exc}" }`.

### Exceptions that are **not** wrapped

| Case | Shape |
|---|---|
| Missing/invalid Bearer token | DRF 401 `{ detail }` |
| Inactive user on JWT | 401 `{ detail: "User is inactive" }` |
| User id missing in token | 401 InvalidToken |
| Wrong role | 403 `{ detail: "<permission.message>" }` |
| Non-numeric `page` | unhandled → DRF 500 |
| Duplicate `token_number` race | unhandled Mongo duplicate key → 500 |
| Token refresh failure | wrapped: `{ success: false, message: "Token refresh failed.", errors: <simplejwt body> }` with simplejwt’s status (usually 401) |

### Permission messages to preserve

| Class | `message` |
|---|---|
| `IsAdmin` | `Admin access required.` |
| `IsReceptionist` | `Receptionist access required.` |
| `IsAdminOrReceptionist` | `Authentication required.` |
| `CanViewPatients` | `You do not have permission to view patients.` |
| `CanCreatePatients` | `You do not have permission to register patients.` |
| `CanUpdatePatients` | `You do not have permission to update patients.` |
| `CanDeletePatients` | `Only administrators can delete patients.` |

### CORS / CSRF

- `CORS_ALLOW_CREDENTIALS = True`
- Allowed origins from `CORS_ALLOWED_ORIGINS`
- CSRF trusted origins from `CSRF_TRUSTED_ORIGINS` (fallback to CORS list)
- API views use JWT, not session auth, so CSRF is not enforced on these endpoints
- Allowed headers include `authorization`, `content-type`, `x-csrftoken`

---

## 23. Environment variables

From `.env.example` and code (`config/settings/*`, `config/mongodb.py`).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DJANGO_ENV` | no | `development` | `development` vs `production` settings module |
| `SECRET_KEY` | production yes | `django-insecure-change-me-in-production` | Django + **JWT HMAC secret** |
| `DEBUG` | no | `False` (`True` forced in development.py) | Django debug |
| `ALLOWED_HOSTS` | no | `localhost,127.0.0.1` | comma-separated |
| `MONGODB_URI` | **yes** | — | Atlas connection string; missing → `ImproperlyConfigured` |
| `DATABASE_NAME` | no | `doctor_db` | Mongo database name |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | no | `10000` | server selection timeout |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | no | `60` | access TTL |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | no | `7` | refresh TTL |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | comma-separated |
| `CSRF_TRUSTED_ORIGINS` | no | same as CORS | comma-separated |
| `SECURE_SSL_REDIRECT` | production | `True` | HTTPS redirect |

### Mongo URI behavior

If URI starts with `mongodb+srv://`, code injects `retryWrites=true` and `w=majority` when missing. TLS uses `certifi` CA bundle (`tlsCAFile`). Startup **pings** `admin.command("ping")`; failure aborts boot with an Atlas IP/TLS hint.

### Node env mapping (suggested)

Keep the same names where possible so ops does not retune Atlas/CORS:

```
PORT=8000
NODE_ENV=development|production
SECRET_KEY=                 # must match current JWT secret if tokens overlap
MONGODB_URI=
DATABASE_NAME=doctor_db
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
CORS_ALLOWED_ORIGINS=
ALLOWED_HOSTS=              # Express equivalent: trust proxy / bind
MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000
```

Do **not** commit real `.env` values. Current `backend/.env` is gitignored.

---

## 24. External dependencies

Pinned in `backend/requirements.txt`:

| Package | Version | Used for |
|---|---|---|
| Django | 6.0.8 | HTTP, settings, password hashers/validators, management commands |
| djangorestframework | 3.17.1 | APIView, serializers, permissions |
| djangorestframework_simplejwt | 5.5.1 | JWT create/verify/refresh |
| PyJWT | 2.13.0 | JWT crypto (transitive, pinned) |
| django-cors-headers | 4.9.0 | CORS |
| mongoengine | 0.29.3 | ODM |
| pymongo | 4.17.0 | Mongo driver |
| dnspython | 2.8.0 | mongodb+srv DNS |
| certifi | 2026.7.22 | TLS CA for Atlas |
| python-dotenv | 1.2.2 | `.env` loading |
| asgiref | 3.12.1 | Django ASGI |
| sqlparse | 0.5.5 | Django (unused SQL) |
| psycopg2-binary | 2.9.12 | **unused** (no Postgres) |

Python standard library: `datetime`, `math`, `logging`, `urllib.parse`.

No Redis, Celery, S3, email, SMS, or payment integrations.

### Process entrypoints

- WSGI: `config.wsgi:application`
- ASGI: `config.asgi:application`
- Dev: `python manage.py runserver` (typically port 8000; frontend defaults to `http://localhost:8000/api/v1`)

### Management commands to reimplement as CLI or seed scripts

| Command | Behavior |
|---|---|
| `python manage.py create_admin --full-name --email --password` | Create first ADMIN if none exists; hashes password |
| `python manage.py create_user --full-name --email --password --role` | Create ADMIN or RECEPTIONIST |
| `python manage.py purge_soft_deleted_patients` | One-off legacy patient cleanup — optional in Node |

---

## 25. Node.js implementation notes

Parity checklist for Express + TypeScript + Mongoose:

1. **Keep collection and field names exactly** (`users`, `patients`, Django hash strings, `YYYYMMDD-P####` tokens).
2. **Verify Django `pbkdf2_sha256` hashes** (1,200,000 iterations, SHA-256, `$`-delimited). Libraries such as `node-django-hashers` or a small custom verifier. Optionally upgrade to bcrypt **on login** after verify, only if you accept rewriting `users.password`.
3. **JWT:** `jsonwebtoken` HS256, same `SECRET_KEY`, claims `user_id` / `token_type` / `jti` / `email` / `full_name` / `role`. Access 60m, refresh 7d, rotate refresh on `/auth/token/refresh/` without a denylist.
4. **Envelope** `{ success, message, data?, errors? }` for business routes; health stays `{ status, database }`; 401/403 may stay `{ detail }` if the SPA is unchanged.
5. **Trailing slashes** on every route the frontend calls.
6. **UTC day boundaries** for tokens, queue, filters, stats.
7. **ADMIN = doctor.** Protect `/api/v1/doctor/*` and `/api/v1/receptionists/*` with `role === "ADMIN"`.
8. **Mongoose schemas:** `timestamps` custom names `created_at` / `updated_at`; do not use default `createdAt`. Patient schema `strict: false` if legacy extra keys must survive.
9. **Indexes:** unique `email`, unique `token_number`; others as listed. Retry create-patient on duplicate token.
10. **Pagination object** must use `page`, `page_size`, `total`, `total_pages`, `has_next`, `has_previous` (snake_case).
11. **Display token** in patient/queue responses; store full token in Mongo.
12. **Cancel → WAITING**, not `CANCELLED`.
13. **Patient delete = hard delete; receptionist delete = soft delete.**
14. **CORS** must include the Vite origin(s) and LAN IPs used for `/queue`.
15. Do not migrate data off Mongo; point Mongoose at the same `MONGODB_URI` / `DATABASE_NAME`.

### Suggested Express route map

```
app.use("/api/v1/health", healthRouter)
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/receptionists", receptionistRouter)
app.use("/api/v1/patients", patientRouter)
app.use("/api/v1/queue", queueRouter)
app.use("/api/v1/doctor/stats", doctorStatsRouter)
app.use("/api/v1/doctor/patients", doctorRouter)
```

### Frontend contract (already coded)

| Client module | Base calls |
|---|---|
| `frontend/src/api/auth.js` | `/auth/login/`, `/logout/`, `/token/refresh/`, `/me/`, `/change-password/` |
| `frontend/src/api/receptionists.js` | `/receptionists/` CRUD + activate/deactivate |
| `frontend/src/api/patients.js` | `/patients/` CRUD + `stats/` + `lookup/` |
| `frontend/src/api/doctor.js` | `/doctor/patients/` + `completed/` + start/consultation/complete/cancel + `/doctor/stats/` |
| `frontend/src/api/queue.ts` | `GET /queue/` |
| `frontend/src/api/axios.js` | `Authorization: Bearer`, refresh via `body.data.access` |

If those paths, methods, and JSON envelopes stay identical, the SPA does not need changes.

---

*Generated from the Django backend source as of 19 August 2026. Python files and MongoDB were not modified.*
