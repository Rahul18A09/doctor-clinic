# Bed Management APIs

This document describes Bed Management endpoints **by role**, using the permissions actually implemented in the backend.

**Source of truth**

- Authentication: `authenticate` — Bearer JWT. Role is loaded from MongoDB for `user_id` on the token. Client-supplied `role` in the body is ignored.
- Authorization helpers in `src/middleware/authorize.ts`:
  - `canViewBeds` — **ADMIN** and **RECEPTIONIST**. List/view rooms and beds, available beds, and summary.
  - `canAssignBeds` — **ADMIN** and **RECEPTIONIST**. Assign a patient to a bed; release an occupied or reserved bed.
  - `canManageBeds` — **ADMIN** only. Create, update, and delete rooms; create, update, and delete beds; PATCH bed status.
- Files: `src/middleware/authenticate.ts`, `src/middleware/authorize.ts`, `src/routes/rooms.routes.ts`, `src/routes/beds.routes.ts`.

**What this means**

- Admin has full access to every room and bed API.
- Receptionist can view rooms/beds and assign/release occupancy.
- Receptionist **cannot** create, update, or delete rooms; **cannot** create, update, or delete beds; **cannot** PATCH bed status.
- Unauthenticated callers receive `401`. A receptionist on an Admin-only route receives `403` with `{ "detail": "Only administrators can manage rooms and beds." }`.

**Shared conventions**

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <access>`
- Success envelope: `{ "success": true, "message": "...", "data": ... }`
- Business errors: `{ "success": false, "message": "...", "errors": { ... } }` (HTTP 400/404)
- Missing/invalid JWT: `{ "detail": "..." }` (HTTP 401) and `WWW-Authenticate: Bearer realm="api"`
- Pagination (list endpoints): `page` (default 1), `page_size` (default 10, max 100)
- Available-bed counts are **computed** from current bed `status` values. They are not stored.
- Completing a consultation (`POST /api/v1/doctor/patients/{pk}/complete/`) does **not** release beds. Occupancy follows admission/discharge.
- Assign, release, and maintenance use the existing notification pipeline (`patient` for assign/release, `staff` for maintenance). There is no separate bed notification type.
- Room types: `GENERAL`, `PRIVATE`, `SEMI_PRIVATE`, `ICU`, `EMERGENCY`, `WARD`, `OTHER`
- Bed statuses: `available`, `occupied`, `reserved`, `maintenance`, `blocked`
- `pk` path params must be 24-character MongoDB ObjectIds. Invalid ids return 404, not 400.

---

## 1. Admin Bed Management APIs

All endpoints below require a Bearer access token. Role is taken from `req.user`.

- View APIs use `canViewBeds` (Admin and Receptionist).
- Assign/release use `canAssignBeds` (Admin and Receptionist).
- Inventory mutations use `canManageBeds` (Admin only).

### ROOM APIs

#### GET `/api/v1/rooms/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/rooms/` |
| **Purpose** | Paginated list of rooms. `bed_count` and `available_count` are calculated from beds in each room. |
| **Authentication** | Required (`Bearer`) |
| **Required role** | Admin or Receptionist (`canViewBeds`) |

**Query parameters**

| Name | Required | Description |
|---|---|---|
| `page` | No | Page number, default `1` |
| `page_size` | No | Page size, default `10`, max `100` |
| `search` | No | Case-insensitive match on `room_number` or `notes` |
| `room_type` | No | One of the room types above; unknown values are ignored |
| `floor` | No | Case-insensitive contains on `floor` |

**Request body:** none

**Example request**

```http
GET /api/v1/rooms/?page=1&page_size=10&room_type=GENERAL
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`)

```json
{
  "success": true,
  "message": "Rooms retrieved successfully.",
  "data": {
    "results": [
      {
        "id": "68b0aaaaaaaaaaaaaaaaaaaa",
        "room_number": "101",
        "room_type": "GENERAL",
        "floor": "1",
        "capacity": 4,
        "notes": "General ward",
        "bed_count": 2,
        "available_count": 1,
        "created_at": "2026-09-02T09:00:00",
        "updated_at": "2026-09-02T09:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_previous": false
    }
  }
}
```

**Possible errors**

| Status | When |
|---|---|
| `401` | Missing, invalid, expired, inactive, or deleted user JWT |
| `403` | Authenticated user is not Admin or Receptionist |

**Validation:** pagination is clamped (`page >= 1`, `page_size` 1–100). Invalid numeric page values throw like other list APIs.

---

#### POST `/api/v1/rooms/`

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/rooms/` |
| **Purpose** | Create a room |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Path/query:** none

**Request body**

| Field | Required | Rules |
|---|---|---|
| `room_number` | Yes | String, max 50, unique |
| `room_type` | Yes | Must be a valid room type |
| `floor` | Yes | String, max 50 |
| `capacity` | Yes | Integer 1–200 |
| `notes` | No | String, max 1000, blank allowed |

**Example request**

```http
POST /api/v1/rooms/
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "room_number": "101",
  "room_type": "GENERAL",
  "floor": "1",
  "capacity": 4,
  "notes": "General ward"
}
```

**Example response** (`201`)

```json
{
  "success": true,
  "message": "Room created successfully.",
  "data": {
    "room": {
      "id": "68b0aaaaaaaaaaaaaaaaaaaa",
      "room_number": "101",
      "room_type": "GENERAL",
      "floor": "1",
      "capacity": 4,
      "notes": "General ward",
      "bed_count": 0,
      "available_count": 0,
      "created_at": "2026-09-02T09:00:00",
      "updated_at": "2026-09-02T09:00:00"
    }
  }
}
```

**Possible errors**

| Status | Message / shape |
|---|---|
| `400` | Field errors (`room_number`, `room_type`, `floor`, `capacity`, `notes`). Duplicate number: `A room with this room number already exists.` |
| `401` | JWT missing/invalid |
| `403` | Not Admin (`canManageBeds`) |

---

#### GET `/api/v1/rooms/{pk}/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/rooms/{pk}/` |
| **Purpose** | Room details plus all beds in that room |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canViewBeds`) |

**Path parameters:** `pk` — room ObjectId

**Request body:** none

**Example request**

```http
GET /api/v1/rooms/68b0aaaaaaaaaaaaaaaaaaaa/
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`)

```json
{
  "success": true,
  "message": "Room retrieved successfully.",
  "data": {
    "room": {
      "id": "68b0aaaaaaaaaaaaaaaaaaaa",
      "room_number": "101",
      "room_type": "GENERAL",
      "floor": "1",
      "capacity": 4,
      "notes": "General ward",
      "bed_count": 2,
      "available_count": 1,
      "created_at": "2026-09-02T09:00:00",
      "updated_at": "2026-09-02T09:00:00"
    },
    "beds": [
      {
        "id": "68b0bbbbbbbbbbbbbbbbbbbb",
        "room_id": "68b0aaaaaaaaaaaaaaaaaaaa",
        "bed_number": "A",
        "status": "available",
        "patient_id": null,
        "assigned_at": null,
        "created_at": "2026-09-02T09:05:00",
        "updated_at": "2026-09-02T09:05:00"
      }
    ]
  }
}
```

**Possible errors:** `401`, `403`, `404` `Room not found.` (unknown or invalid `pk`)

---

#### PUT `/api/v1/rooms/{pk}/`

| | |
|---|---|
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/rooms/{pk}/` |
| **Purpose** | Partial update of a room |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Path parameters:** `pk` — room ObjectId

**Request body:** any subset of `room_number`, `room_type`, `floor`, `capacity`, `notes` (same field rules as create)

**Example request**

```http
PUT /api/v1/rooms/68b0aaaaaaaaaaaaaaaaaaaa/
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "capacity": 6, "notes": "Expanded ward" }
```

**Example response** (`200`) — `{ success: true, message: "Room updated successfully.", data: { room: { ... } } }`

**Possible errors:** `400` (validation; capacity below existing bed count: `Capacity cannot be less than the number of beds in the room.`; duplicate `room_number`), `401`, `403`, `404` `Room not found.`

---

#### DELETE `/api/v1/rooms/{pk}/`

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/api/v1/rooms/{pk}/` |
| **Purpose** | Delete a room and its idle beds |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Path parameters:** `pk` — room ObjectId  
**Request body:** none

**Example request**

```http
DELETE /api/v1/rooms/68b0aaaaaaaaaaaaaaaaaaaa/
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`)

```json
{ "success": true, "message": "Room deleted successfully." }
```

**Possible errors:** `400` `Cannot delete a room that has occupied or reserved beds.`, `401`, `403`, `404` `Room not found.`

---

### BED APIs

#### GET `/api/v1/beds/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/` |
| **Purpose** | Paginated list of beds |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canViewBeds`) |

**Query parameters:** `page`, `page_size`, `room_id` (valid ObjectId), `patient_id` (valid ObjectId of the assigned visit), `status` (valid bed status)

**Request body:** none

**Example request**

```http
GET /api/v1/beds/?room_id=68b0aaaaaaaaaaaaaaaaaaaa&status=available
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`) — paginated `data.results` of bed objects (see GET room for bed shape). Message: `Beds retrieved successfully.`

**Possible errors:** `400` invalid `room_id` (`Enter a valid room id.`), invalid `patient_id` (`Enter a valid patient id.`), or invalid `status` (`"<value>" is not a valid choice.`), `401`, `403`

---

#### POST `/api/v1/beds/`

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/beds/` |
| **Purpose** | Create a bed in a room |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Request body**

| Field | Required | Rules |
|---|---|---|
| `room_id` | Yes | 24-hex ObjectId of an existing room |
| `bed_number` | Yes | String, max 20, unique per room |
| `status` | No | Default `available`. Must not be `occupied` |

**Example request**

```http
POST /api/v1/beds/
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "room_id": "68b0aaaaaaaaaaaaaaaaaaaa", "bed_number": "A" }
```

**Example response** (`201`) — `{ success: true, message: "Bed created successfully.", data: { bed: { ... } } }`

**Possible errors:** `400` validation, duplicate bed number, `This room has no remaining bed capacity.`, or occupy-at-create (`Use assign to occupy a bed.`); `401`; `403`; `404` `Room not found.`

---

#### GET `/api/v1/beds/available/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/available/` |
| **Purpose** | List beds whose **current** status is `available` |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canViewBeds`) |

**Query parameters:** `page`, `page_size`, optional `room_id`

**Request body:** none

**Example request**

```http
GET /api/v1/beds/available/?room_id=68b0aaaaaaaaaaaaaaaaaaaa
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`) — message `Available beds retrieved successfully.` Results are computed from `status = available`, not from a stored counter.

**Possible errors:** `400` invalid `room_id`, `401`, `403`

---

#### GET `/api/v1/beds/summary/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/summary/` |
| **Purpose** | Counts by status, aggregated from live bed documents |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canViewBeds`) |

**Path/query / body:** none

**Example request**

```http
GET /api/v1/beds/summary/
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`)

```json
{
  "success": true,
  "message": "Bed summary retrieved successfully.",
  "data": {
    "summary": {
      "total": 10,
      "available": 6,
      "occupied": 2,
      "reserved": 1,
      "maintenance": 1,
      "blocked": 0
    }
  }
}
```

**Possible errors:** `401`, `403`

---

#### GET `/api/v1/beds/{pk}/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/{pk}/` |
| **Purpose** | Get one bed |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canViewBeds`) |

**Path parameters:** `pk` — bed ObjectId  
**Request body:** none

**Example request:** `GET /api/v1/beds/68b0bbbbbbbbbbbbbbbbbbbb/`  
**Example response** (`200`) — `{ success: true, message: "Bed retrieved successfully.", data: { bed: { ... } } }`  
**Possible errors:** `401`, `403`, `404` `Bed not found.`

---

#### PUT `/api/v1/beds/{pk}/`

| | |
|---|---|
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/beds/{pk}/` |
| **Purpose** | Update `bed_number` and/or `status` |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Path parameters:** `pk` — bed ObjectId

**Request body:** optional `bed_number`, optional `status`

**Important validation**

- Cannot set `status` to `occupied` here (use assign).
- Occupied beds must be released before any other status change.
- Duplicate `bed_number` in the same room is rejected.

**Example request**

```http
PUT /api/v1/beds/68b0bbbbbbbbbbbbbbbbbbbb/
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "bed_number": "A1", "status": "maintenance" }
```

**Example response** (`200`) — `Bed updated successfully.`  
**Possible errors:** `400` (`Use assign to occupy a bed.`, `Occupied beds must be released before changing status.`, duplicate bed number), `401`, `403`, `404` `Bed not found.`

---

#### DELETE `/api/v1/beds/{pk}/`

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/api/v1/beds/{pk}/` |
| **Purpose** | Delete a bed that is not occupied or reserved |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Path parameters:** `pk`  
**Request body:** none

**Example request:** `DELETE /api/v1/beds/68b0bbbbbbbbbbbbbbbbbbbb/`  
**Example response** (`200`) — `Bed deleted successfully.`  
**Possible errors:** `400` `Cannot delete an occupied or reserved bed.`, `401`, `403`, `404` `Bed not found.`

---

#### POST `/api/v1/beds/{pk}/assign/`

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/beds/{pk}/assign/` |
| **Purpose** | Assign a patient to a bed (sets `occupied`, `patient_id`, `assigned_at`) |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canAssignBeds`) |

**Path parameters:** `pk` — bed ObjectId

**Request body:** `{ "patient_id": "<24-hex visit/patient ObjectId>" }` (required)

**Important validation**

- Bed must currently be `available` or `reserved`.
- `occupied`, `maintenance`, and `blocked` beds cannot be assigned.
- Patient id must exist.
- A patient cannot already have another **occupied** or **reserved** bed.

**Example request**

```http
POST /api/v1/beds/68b0bbbbbbbbbbbbbbbbbbbb/assign/
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "patient_id": "68b0cccccccccccccccccccc" }
```

**Example response** (`200`)

```json
{
  "success": true,
  "message": "Bed assigned successfully.",
  "data": {
    "bed": {
      "id": "68b0bbbbbbbbbbbbbbbbbbbb",
      "room_id": "68b0aaaaaaaaaaaaaaaaaaaa",
      "bed_number": "A",
      "status": "occupied",
      "patient_id": "68b0cccccccccccccccccccc",
      "assigned_at": "2026-09-02T10:00:00",
      "created_at": "2026-09-02T09:05:00",
      "updated_at": "2026-09-02T10:00:00"
    }
  }
}
```

**Possible errors**

| Status | Message |
|---|---|
| `400` | Missing/invalid `patient_id`; `Only available beds can be assigned.`; `Only inpatients with admission pending can be assigned a bed.`; `This patient is already assigned to another bed.` |
| `401` | JWT missing/invalid |
| `403` | Not Admin or Receptionist (`canAssignBeds`) |
| `404` | `Bed not found.` or `Patient not found.` |

---

#### POST `/api/v1/beds/{pk}/release/`

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/beds/{pk}/release/` |
| **Purpose** | Clear occupancy and set status to `available` |
| **Authentication** | Required |
| **Required role** | Admin or Receptionist (`canAssignBeds`) |

**Path parameters:** `pk`  
**Request body:** none

**Validation:** only `occupied` or `reserved` beds can be released.

**Example request**

```http
POST /api/v1/beds/68b0bbbbbbbbbbbbbbbbbbbb/release/
Authorization: Bearer <admin_access_token>
```

**Example response** (`200`) — `Bed released successfully.` `status` is `available`, `patient_id` and `assigned_at` are `null`.

**Possible errors:** `400` `Only occupied or reserved beds can be released.`, `401`, `403`, `404` `Bed not found.`

---

#### PATCH `/api/v1/beds/{pk}/status/`

| | |
|---|---|
| **Method** | `PATCH` |
| **Endpoint** | `/api/v1/beds/{pk}/status/` |
| **Purpose** | Change bed status without using assign |
| **Authentication** | Required |
| **Required role** | Admin (`canManageBeds`) |

**Path parameters:** `pk`

**Request body:** `{ "status": "maintenance" }` (required; must be a valid bed status)

**Important validation**

- Cannot set `occupied` (`Use assign to occupy a bed.`).
- Occupied beds must be released first (`Occupied beds must be released before changing status.`).
- Setting a status other than `reserved` clears `patient_id` and `assigned_at`.

**Example request**

```http
PATCH /api/v1/beds/68b0bbbbbbbbbbbbbbbbbbbb/status/
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "status": "blocked" }
```

**Example response** (`200`) — `Bed status updated successfully.`  
**Possible errors:** `400` invalid status / invalid transition, `401`, `403`, `404` `Bed not found.`

---

## 2. Receptionist Bed Management APIs

**Permission implementation**

- Viewing: `authenticate` + `canViewBeds` (`ADMIN`, `RECEPTIONIST`)
- Assign/release: `authenticate` + `canAssignBeds` (`ADMIN`, `RECEPTIONIST`)
- Inventory mutations: `authenticate` + `canManageBeds` (**ADMIN only**). Receptionist receives `403`.

Request/response shapes match section 1. Below: method, endpoint, purpose, auth, role, and **permission restrictions**. Use section 1 for full bodies, examples, and validation where noted.

### Viewing

#### GET `/api/v1/rooms/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/rooms/` |
| **Purpose** | List rooms with computed `bed_count` / `available_count` |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `page`, `page_size`, `search`, `room_type`, `floor` |
| **Request body** | none |
| **Example request** | `GET /api/v1/rooms/?page=1` with `Authorization: Bearer <receptionist_access_token>` |
| **Example response** | Same as Admin list rooms |
| **Possible errors** | `401`, `403` |
| **Permission restrictions** | `canViewBeds`. Unauthenticated callers cannot list rooms. |

#### GET `/api/v1/rooms/{pk}/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/rooms/{pk}/` |
| **Purpose** | View room details and beds |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `pk` room ObjectId |
| **Request body** | none |
| **Example request** | `GET /api/v1/rooms/{pk}/` with receptionist token |
| **Example response** | Same as Admin get room |
| **Possible errors** | `401`, `403`, `404` `Room not found.` |
| **Permission restrictions** | `canViewBeds`. Invalid/unknown id is 404, not a role error. |

#### GET `/api/v1/beds/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/` |
| **Purpose** | View beds (optional `room_id`, `status` filters) |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `page`, `page_size`, `room_id`, `status` |
| **Request body** | none |
| **Example request / response** | Same as Admin list beds |
| **Possible errors** | `400` invalid filter, `401`, `403` |
| **Permission restrictions** | `canViewBeds` |

#### GET `/api/v1/beds/available/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/available/` |
| **Purpose** | View currently available beds |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `page`, `page_size`, optional `room_id` |
| **Request body** | none |
| **Example request / response** | Same as Admin available beds |
| **Possible errors** | `400`, `401`, `403` |
| **Permission restrictions** | `canViewBeds`. Availability is live status, not a stored counter. |

#### GET `/api/v1/beds/summary/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/summary/` |
| **Purpose** | View bed availability counts by status |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query / body** | none |
| **Example request / response** | Same as Admin summary |
| **Possible errors** | `401`, `403` |
| **Permission restrictions** | `canViewBeds` |

#### GET `/api/v1/beds/{pk}/`

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/beds/{pk}/` |
| **Purpose** | View one bed |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `pk` bed ObjectId |
| **Request body** | none |
| **Example request / response** | Same as Admin get bed |
| **Possible errors** | `401`, `403`, `404` `Bed not found.` |
| **Permission restrictions** | `canViewBeds` |

### Assign and release

#### POST `/api/v1/beds/{pk}/assign/`

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/beds/{pk}/assign/` |
| **Purpose** | Assign an inpatient who requires admission to an available bed |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `pk` bed ObjectId |
| **Request body** | `{ "patient_id": "<ObjectId>" }` |
| **Example request / response** | Same as Admin assign |
| **Possible errors** | Same as Admin assign (`400` / `404` / `401` / `403`) |
| **Permission restrictions** | `canAssignBeds`. Same assignment rules as Admin: no occupied/maintenance/blocked beds; one active bed per patient. |

#### POST `/api/v1/beds/{pk}/release/`

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/beds/{pk}/release/` |
| **Purpose** | Release an occupied or reserved bed if the existing occupancy workflow allows it |
| **Authentication** | Bearer JWT |
| **Required role** | `RECEPTIONIST` (Admin also authorized) |
| **Path/query** | `pk` bed ObjectId |
| **Request body** | none |
| **Example request / response** | Same as Admin release |
| **Possible errors** | Same as Admin release |
| **Permission restrictions** | `canAssignBeds`. Only occupied or reserved beds can be released. |

### Admin-only APIs (Receptionist forbidden)

Receptionist calls to these routes return `403` `{ "detail": "Only administrators can manage rooms and beds." }`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/rooms/` | Create room |
| `PUT` | `/api/v1/rooms/{pk}/` | Update room |
| `DELETE` | `/api/v1/rooms/{pk}/` | Delete room |
| `POST` | `/api/v1/beds/` | Create bed |
| `PUT` | `/api/v1/beds/{pk}/` | Update bed number/status |
| `DELETE` | `/api/v1/beds/{pk}/` | Delete bed |
| `PATCH` | `/api/v1/beds/{pk}/status/` | Change bed status |

---

## 3. Permission matrix

Derived from the middleware stacks in `rooms.routes.ts` and `beds.routes.ts`: `canViewBeds`, `canAssignBeds`, and `canManageBeds`.

| API | Admin | Receptionist |
|---|---|---|
| List Rooms `GET /rooms/` | Yes | Yes |
| Get Room `GET /rooms/{pk}/` | Yes | Yes |
| Create Room `POST /rooms/` | Yes | No |
| Update Room `PUT /rooms/{pk}/` | Yes | No |
| Delete Room `DELETE /rooms/{pk}/` | Yes | No |
| List Beds `GET /beds/` | Yes | Yes |
| Get Bed `GET /beds/{pk}/` | Yes | Yes |
| Available Beds `GET /beds/available/` | Yes | Yes |
| Bed Summary `GET /beds/summary/` | Yes | Yes |
| Create Bed `POST /beds/` | Yes | No |
| Update Bed `PUT /beds/{pk}/` | Yes | No |
| Delete Bed `DELETE /beds/{pk}/` | Yes | No |
| Update Bed Status `PATCH /beds/{pk}/status/` | Yes | No |
| Assign Patient `POST /beds/{pk}/assign/` | Yes | Yes |
| Release Bed `POST /beds/{pk}/release/` | Yes | Yes |

