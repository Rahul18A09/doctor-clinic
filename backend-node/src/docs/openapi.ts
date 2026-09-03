import type { JsonObject } from "swagger-ui-express";

/**
 * OpenAPI 3 contract for the implemented Node APIs.
 * Paths, bodies, statuses, and examples match Django / MIGRATION_ANALYSIS.md.
 * Paths, bodies, statuses, and examples match Django / MIGRATION_ANALYSIS.md.
 */
export const openApiDocument: JsonObject = {
  openapi: "3.0.3",
  info: {
    title: "Clinic API",
    version: "1.0.0",
    description: [
      "Node.js rewrite of the Django clinic backend.",
      "",
      "Same paths, request bodies, response envelopes, HTTP statuses, and JWT behavior as Django.",
      "",
      "**How to try authenticated routes**",
      "1. Call `POST /api/v1/auth/login/`.",
      "2. Copy `data.access`.",
      "3. Click **Authorize** and paste the access token (without the `Bearer ` prefix).",
      "",
      "**Response shapes**",
      "- Business routes use `{ success, message, data?, errors? }`.",
      "- Missing/invalid JWT uses DRF `{ detail }` and `WWW-Authenticate: Bearer realm=\"api\"`.",
      "- Health is not enveloped: `{ status, database }`.",
      "- Invalid refresh tokens return HTTP 401 with the business envelope (`errors.detail` / `errors.code`).",
      "",
      "**Bed Management**",
      "Documented by role under tags **Admin Bed Management** and **Receptionist Bed Management**.",
      "Admin has full inventory access (`canManageBeds`). Receptionist may view rooms/beds (`canViewBeds`) and assign/release (`canAssignBeds`). See `docs/bed-management.md`.",
    ].join("\n"),
  },
  servers: [
    {
      url: "http://127.0.0.1:8001",
      description: "Node.js (default dual-run port)",
    },
    {
      url: "http://localhost:8001",
      description: "Node.js (localhost)",
    },
  ],
  tags: [
    { name: "Health", description: "Process liveness. Always HTTP 200 if the server is up." },
    { name: "Auth", description: "Login, logout, JWT refresh, current user, and change password." },
    { name: "Receptionists", description: "Admin-only receptionist CRUD, soft delete, activate/deactivate." },
    { name: "Patients", description: "Patient registration, list, lookup, stats. Admin or receptionist; delete is admin-only." },
    { name: "Doctor", description: "Admin-only consultation workflow: list, start, save, complete, cancel, stats." },
    { name: "Queue", description: "Public live queue. Unauthenticated. UTC today window." },
    { name: "Settings", description: "Admin-only clinic, queue, notification, and preference settings stored in MongoDB." },
    { name: "Notifications", description: "In-app inbox for the logged-in admin or receptionist. Records belong to the current user only. Receptionist consultation events cover started, completed, and cancelled treatments." },
    { name: "Reports", description: "Admin-only historical analytics for a date range. Dashboard remains today/live." },
    {
      name: "Admin Bed Management",
      description: [
        "Bed Management APIs an Admin may call.",
        "Inventory mutations use `canManageBeds` (ADMIN only): create/update/delete rooms and beds, and PATCH bed status.",
        "Shared read and occupancy APIs use `canViewBeds` / `canAssignBeds` (ADMIN and RECEPTIONIST).",
        "Full request/response examples: `docs/bed-management.md`.",
        "Available-bed counts are calculated from bed statuses, not stored.",
      ].join(" "),
    },
    {
      name: "Receptionist Bed Management",
      description: [
        "Bed Management APIs a Receptionist may call.",
        "Implemented permissions: `canViewBeds` for list/view rooms and beds, available beds, and summary;",
        "`canAssignBeds` for assign and release.",
        "Receptionist cannot create, update, or delete rooms; cannot create, update, or delete beds; cannot PATCH bed status.",
        "Full documentation: `docs/bed-management.md`.",
      ].join(" "),
    },
  ],
  security: [{ BearerAuth: [] }],
  paths: {
    "/api/v1/health/": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        operationId: "getHealth",
        security: [],
        description:
          "Returns process status. Always HTTP 200 if the process is up, even when MongoDB is disconnected.",
        responses: {
          "200": {
            description: "Server is up.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                examples: {
                  connected: {
                    value: { status: "ok", database: "connected" },
                  },
                  disconnected: {
                    value: { status: "ok", database: "disconnected" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login/": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        operationId: "login",
        security: [],
        description: [
          "Authenticates with email + password.",
          "",
          "Existing Django `pbkdf2_sha256` hashes continue to work. Login does not rewrite the stored hash.",
          "Email is stripped and lowercased. Password whitespace is preserved.",
          "On success, `last_login` and `updated_at` are updated.",
          "JWT claims: `user_id`, `email`, `full_name`, `role`, `token_type`, `jti`, `iat`, `exp`.",
          "Access lifetime 60 minutes. Refresh lifetime 7 days. Algorithm HS256.",
          "",
          "`message` on 400 is the first serializer error string, not a generic label.",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
              examples: {
                valid: {
                  value: {
                    email: "admin@gmail.com",
                    password: "your-password",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginSuccessResponse" },
                example: {
                  success: true,
                  message: "Login successful.",
                  data: {
                    access: "<JWT access>",
                    refresh: "<JWT refresh>",
                    user: {
                      id: "6a72b26dedcd1f8304e2f138",
                      full_name: "Admin User",
                      email: "admin@gmail.com",
                      role: "ADMIN",
                      is_active: true,
                      last_login: "2026-08-19T11:00:00",
                      created_at: "2026-01-01T00:00:00",
                      updated_at: "2026-08-19T11:00:00",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation or authentication failure (enveloped).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                examples: {
                  emailRequired: {
                    summary: "Missing email",
                    value: {
                      success: false,
                      message: "This field is required.",
                      errors: { email: ["This field is required."] },
                    },
                  },
                  emailBlank: {
                    summary: "Blank email",
                    value: {
                      success: false,
                      message: "This field may not be blank.",
                      errors: { email: ["This field may not be blank."] },
                    },
                  },
                  emailInvalid: {
                    summary: "Invalid email",
                    value: {
                      success: false,
                      message: "Enter a valid email address.",
                      errors: { email: ["Enter a valid email address."] },
                    },
                  },
                  unknownEmail: {
                    summary: "Unknown email",
                    value: {
                      success: false,
                      message: "No account found with email 'nobody@example.com'.",
                      errors: {
                        email: ["No account found with email 'nobody@example.com'."],
                      },
                    },
                  },
                  incorrectPassword: {
                    summary: "Incorrect password",
                    value: {
                      success: false,
                      message: "Incorrect password.",
                      errors: { password: ["Incorrect password."] },
                    },
                  },
                  deactivated: {
                    summary: "Inactive account",
                    value: {
                      success: false,
                      message: "This account has been deactivated.",
                      errors: {
                        non_field_errors: ["This account has been deactivated."],
                      },
                    },
                  },
                  deleted: {
                    summary: "Deleted account",
                    value: {
                      success: false,
                      message: "This account no longer exists.",
                      errors: {
                        non_field_errors: ["This account no longer exists."],
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Token generation failed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                example: {
                  success: false,
                  message: "Token generation failed: Unknown error",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/logout/": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        operationId: "logout",
        description:
          "Requires a Bearer access token. The server does not read the body and does not blacklist tokens. The client should discard access and refresh tokens.",
        responses: {
          "200": {
            description: "Logout successful.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageSuccessResponse" },
                example: {
                  success: true,
                  message: "Logout successful.",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/auth/token/refresh/": {
      post: {
        tags: ["Auth"],
        summary: "Refresh JWT pair",
        operationId: "refreshToken",
        security: [],
        description: [
          "Public endpoint. Send the refresh token in the JSON body, not the Authorization header.",
          "Rotates both access and refresh (`ROTATE_REFRESH_TOKENS = True`). Previous refresh tokens are not blacklisted.",
          "Claims are copied from the old refresh token. The user is not re-fetched from MongoDB.",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
              example: { refresh: "<JWT refresh>" },
            },
          },
        },
        responses: {
          "200": {
            description: "New access and refresh tokens.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshSuccessResponse" },
                example: {
                  success: true,
                  message: "Token refreshed successfully.",
                  data: {
                    access: "<JWT access>",
                    refresh: "<JWT refresh>",
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing or blank refresh field.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                examples: {
                  required: {
                    summary: "Missing refresh",
                    value: {
                      success: false,
                      message: "Token refresh failed.",
                      errors: { refresh: ["This field is required."] },
                    },
                  },
                  blank: {
                    summary: "Blank refresh",
                    value: {
                      success: false,
                      message: "Token refresh failed.",
                      errors: { refresh: ["This field may not be blank."] },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description:
              "Invalid or expired refresh token. Business envelope (not `{ detail }`).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                example: {
                  success: false,
                  message: "Token refresh failed.",
                  errors: {
                    detail: "Token is invalid or expired",
                    code: "token_not_valid",
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/me/": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        operationId: "getCurrentUser",
        description: "Returns the authenticated user via UserSerializer. Requires a Bearer access token.",
        responses: {
          "200": {
            description: "User retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MeSuccessResponse" },
                example: {
                  success: true,
                  message: "User retrieved successfully.",
                  data: {
                    user: {
                      id: "6a72b26dedcd1f8304e2f138",
                      full_name: "Admin User",
                      email: "admin@gmail.com",
                      mobile: "9876543210",
                      role: "ADMIN",
                      is_active: true,
                      last_login: "2026-08-19T11:00:00",
                      created_at: "2026-01-01T00:00:00",
                      updated_at: "2026-08-19T11:00:00",
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": {
            description: "User not found or soft-deleted after the token was issued.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                example: {
                  success: false,
                  message: "User not found.",
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Auth"],
        summary: "Update current user profile",
        operationId: "updateCurrentUser",
        description: [
          "Requires a Bearer access token.",
          "Updates only `full_name` and/or `mobile`. Role, email, account status, and other fields are ignored.",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateMeRequest" },
              example: {
                full_name: "Harshad Kakadiya",
                mobile: "9876543210",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MeSuccessResponse" },
                example: {
                  success: true,
                  message: "Profile updated successfully.",
                  data: {
                    user: {
                      id: "6a72b26dedcd1f8304e2f138",
                      full_name: "Harshad Kakadiya",
                      email: "harshadkakadiya888@gmail.com",
                      mobile: "9876543210",
                      role: "RECEPTIONIST",
                      is_active: true,
                      last_login: "2026-08-21T09:32:00",
                      created_at: "2026-01-01T00:00:00",
                      updated_at: "2026-08-21T10:00:00",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation failure (enveloped).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                examples: {
                  missingFields: {
                    summary: "Neither allowed field provided",
                    value: {
                      success: false,
                      message: "Provide full_name or mobile.",
                    },
                  },
                  invalidMobile: {
                    summary: "Invalid mobile",
                    value: {
                      success: false,
                      message: "Enter a valid 10-digit mobile number.",
                      errors: {
                        mobile: ["Enter a valid 10-digit mobile number."],
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": {
            description: "User not found or soft-deleted after the token was issued.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                example: {
                  success: false,
                  message: "User not found.",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/change-password/": {
      post: {
        tags: ["Auth"],
        summary: "Change password",
        operationId: "changePassword",
        description: [
          "Requires a Bearer access token.",
          "Stores a new Django-format `pbkdf2_sha256$1200000$…` hash. Does not change other user fields.",
          "",
          "New password validators (Django-compatible):",
          "- at least 8 characters",
          "- not a common password",
          "- not entirely numeric",
          "- must match `confirm_password`",
          "- must differ from `current_password`",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
              example: {
                current_password: "old-password",
                new_password: "NewPass-Example8",
                confirm_password: "NewPass-Example8",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password changed successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageSuccessResponse" },
                example: {
                  success: true,
                  message: "Password changed successfully.",
                },
              },
            },
          },
          "400": {
            description: "Validation failure (enveloped).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                examples: {
                  currentIncorrect: {
                    summary: "Current password incorrect",
                    value: {
                      success: false,
                      message: "Password change failed.",
                      errors: {
                        current_password: ["Current password is incorrect."],
                      },
                    },
                  },
                  mismatch: {
                    summary: "Confirm does not match",
                    value: {
                      success: false,
                      message: "Password change failed.",
                      errors: {
                        confirm_password: ["Passwords do not match."],
                      },
                    },
                  },
                  sameAsCurrent: {
                    summary: "New password equals current",
                    value: {
                      success: false,
                      message: "Password change failed.",
                      errors: {
                        new_password: [
                          "New password must be different from current password.",
                        ],
                      },
                    },
                  },
                  tooShort: {
                    summary: "Too short",
                    value: {
                      success: false,
                      message: "Password change failed.",
                      errors: {
                        new_password: [
                          "This password is too short. It must contain at least 8 characters.",
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": {
            description: "User not found or soft-deleted.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                example: {
                  success: false,
                  message: "User not found.",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/receptionists/": {
      get: {
        tags: ["Receptionists"],
        summary: "List receptionists",
        operationId: "listReceptionists",
        description:
          "Admin only. `role=RECEPTIONIST` and `is_deleted=false`. Optional icontains search on full_name, email, mobile. Sort `-created_at`. Default page_size 10, max 100.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          {
            name: "page_size",
            in: "query",
            schema: { type: "integer", default: 10, minimum: 1, maximum: 100 },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated receptionist list.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReceptionistListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
      post: {
        tags: ["Receptionists"],
        summary: "Create receptionist",
        operationId: "createReceptionist",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReceptionistCreateRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Receptionist created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReceptionistItemResponse" },
                example: {
                  success: true,
                  message: "Receptionist created successfully.",
                  data: { receptionist: { id: "…", full_name: "Desk", email: "desk@example.com" } },
                },
              },
            },
          },
          "400": {
            description: "Validation failed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/receptionists/{pk}/": {
      parameters: [
        {
          name: "pk",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "MongoDB ObjectId of a non-deleted receptionist.",
        },
      ],
      get: {
        tags: ["Receptionists"],
        summary: "Get receptionist",
        operationId: "getReceptionist",
        responses: {
          "200": {
            description: "Receptionist retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReceptionistItemResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/ReceptionistNotFound" },
        },
      },
      put: {
        tags: ["Receptionists"],
        summary: "Update receptionist",
        operationId: "updateReceptionist",
        description: "Partial update despite PUT. Password cannot be changed here.",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReceptionistUpdateRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Receptionist updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReceptionistItemResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/ReceptionistNotFound" },
        },
      },
      delete: {
        tags: ["Receptionists"],
        summary: "Soft-delete receptionist",
        operationId: "deleteReceptionist",
        description: "Sets `is_deleted=true` and `is_active=false`. Document remains in `users`.",
        responses: {
          "200": {
            description: "Receptionist deleted successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageSuccessResponse" },
                example: { success: true, message: "Receptionist deleted successfully." },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/ReceptionistNotFound" },
        },
      },
    },
    "/api/v1/receptionists/{pk}/activate/": {
      post: {
        tags: ["Receptionists"],
        summary: "Activate receptionist",
        operationId: "activateReceptionist",
        parameters: [
          { name: "pk", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Receptionist activated successfully.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ReceptionistItemResponse" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/ReceptionistNotFound" },
        },
      },
    },
    "/api/v1/receptionists/{pk}/deactivate/": {
      post: {
        tags: ["Receptionists"],
        summary: "Deactivate receptionist",
        operationId: "deactivateReceptionist",
        parameters: [
          { name: "pk", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Receptionist deactivated successfully.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ReceptionistItemResponse" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/ReceptionistNotFound" },
        },
      },
    },
    "/api/v1/patients/": {
      get: {
        tags: ["Patients"],
        summary: "List patients",
        operationId: "listPatients",
        description:
          "Admin or receptionist. Search icontains on patient_name, mobile, stored token_number, patient_id. status / filter / date as in Django apply_filters. Sort `-created_at`.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", default: 10, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "filter", in: "query", schema: { type: "string", enum: ["waiting", "completed", "today", "admission_required"] } },
          { name: "date", in: "query", schema: { type: "string", format: "date" } },
          { name: "care_type", in: "query", schema: { type: "string", enum: ["Outpatient", "Inpatient"] } },
          { name: "admission_status", in: "query", schema: { type: "string", enum: ["Not Required", "Pending", "Admitted", "Discharged", "Admission Required"] } },
        ],
        responses: {
          "200": {
            description: "Patients retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientListResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewPatients" },
        },
      },
      post: {
        tags: ["Patients"],
        summary: "Register patient",
        operationId: "createPatient",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/PatientCreateRequest" } },
          },
        },
        responses: {
          "201": {
            description: "Patient registered successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Validation failed.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenCreatePatients" },
        },
      },
    },
    "/api/v1/patients/stats/": {
      get: {
        tags: ["Patients"],
        summary: "Patient stats",
        operationId: "getPatientStats",
        responses: {
          "200": {
            description: "Patient stats retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientStatsResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewPatients" },
        },
      },
    },
    "/api/v1/patients/lookup/": {
      get: {
        tags: ["Patients"],
        summary: "Lookup returning patient by mobile, name, and/or Patient ID",
        operationId: "lookupPatient",
        parameters: [
          {
            name: "mobile",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Primary identifier. Exact match. Returns at most one patient identity.",
          },
          {
            name: "patient_name",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Case-insensitive name contains. May return multiple identities; the client must not auto-select.",
          },
          { name: "name", in: "query", required: false, schema: { type: "string" }, description: "Alias of patient_name." },
          { name: "patient_id", in: "query", required: false, schema: { type: "string" } },
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Classified as Patient ID, mobile (digits), or patient name.",
          },
        ],
        responses: {
          "200": {
            description: "Found or not found (both are success envelopes).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientLookupResponse" } } },
          },
          "400": {
            description: "Enter a mobile number or patient name.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewPatients" },
        },
      },
    },
    "/api/v1/patients/{pk}/": {
      parameters: [
        { name: "pk", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Patients"],
        summary: "Get patient",
        operationId: "getPatient",
        responses: {
          "200": {
            description: "Patient retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewPatients" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
      put: {
        tags: ["Patients"],
        summary: "Update patient registration",
        operationId: "updatePatient",
        description:
          "Partial PUT. Receptionist may edit only while WAITING. Admin may edit any status. Does not change visit_number or consultation fields.",
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/PatientUpdateRequest" } },
          },
        },
        responses: {
          "200": {
            description: "Patient updated successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Validation failed or receptionist edit after consultation started.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenUpdatePatients" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
      delete: {
        tags: ["Patients"],
        summary: "Hard-delete patient",
        operationId: "deletePatient",
        description: "Admin only. Permanently removes the document from `patients`.",
        responses: {
          "200": {
            description: "Patient deleted successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageSuccessResponse" },
                example: { success: true, message: "Patient deleted successfully." },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenDeletePatients" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/patients/{pk}/discharge/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["Patients"],
        summary: "Discharge inpatient",
        operationId: "dischargePatient",
        description:
          "Admin or receptionist (`canAssignBeds`). Closes an active Inpatient admission and releases the occupied bed. Consultation status is unchanged.",
        responses: {
          "200": {
            description: "Patient discharged successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "This patient is not currently admitted.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAssignBeds" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/doctor/stats/": {
      get: {
        tags: ["Doctor"],
        summary: "Consultation stats",
        operationId: "getDoctorStats",
        description:
          "Admin only. Same `get_patient_stats()` numbers as `GET /api/v1/patients/stats/`, different message.",
        responses: {
          "200": {
            description: "Consultation stats retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientStatsResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/doctor/patients/": {
      get: {
        tags: ["Doctor"],
        summary: "Doctor patient list",
        operationId: "listDoctorPatients",
        description:
          "Admin only. Default is WAITING, `created_at` ascending. `status=active` is WAITING or IN_CONSULTATION. `filter=today` does not force WAITING. `today=true|1|yes` is UTC today on `created_at` and wins over `filter=completed`.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", default: 10, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "today", in: "query", schema: { type: "string" } },
          { name: "filter", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Patients retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientListResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/doctor/patients/completed/": {
      get: {
        tags: ["Doctor"],
        summary: "Completed patients",
        operationId: "listDoctorCompletedPatients",
        description: "Admin only. Always COMPLETED, sorted by `consultation_completed_at` descending.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", default: 10, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Completed patients retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientListResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/doctor/patients/{pk}/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["Doctor"],
        summary: "Doctor patient details",
        operationId: "getDoctorPatient",
        responses: {
          "200": {
            description: "Patient retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/doctor/patients/{pk}/start/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["Doctor"],
        summary: "Start consultation",
        operationId: "startConsultation",
        description:
          "WAITING → IN_CONSULTATION. Sets `consultation_started_at` and `consulted_by*`. Concurrent starts: only one succeeds. Creates a receptionist `consultation` notification (started) and removes the admin waiting `queue` notification.",
        responses: {
          "200": {
            description: "Consultation started successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Consultation can only be started for patients with WAITING status.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/doctor/patients/{pk}/consultation/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      put: {
        tags: ["Doctor"],
        summary: "Save consultation",
        operationId: "saveConsultation",
        description:
          "Partial PUT. Only while IN_CONSULTATION. Empty body is valid and still sets `updated_by*`.",
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ConsultationSaveRequest" } },
          },
        },
        responses: {
          "200": {
            description: "Consultation saved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Wrong status or field validation (DRF messages).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/doctor/patients/{pk}/care-type/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      put: {
        tags: ["Doctor"],
        summary: "Set Outpatient or Inpatient",
        operationId: "setPatientCareType",
        description:
          "Admin only. Sets `care_type` to Outpatient or Inpatient. Inpatient without a bed becomes Pending. Does not assign a bed. Completing the visit does not discharge an Inpatient or release a bed. Cannot change to Outpatient while Admitted.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["care_type"],
                properties: {
                  care_type: { type: "string", enum: ["Outpatient", "Inpatient"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Patient type saved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Invalid care_type, completed visit, or admitted inpatient.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/doctor/patients/{pk}/complete/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["Doctor"],
        summary: "Complete consultation",
        operationId: "completeConsultation",
        description:
          "WAITING or IN_CONSULTATION → COMPLETED. Direct complete from WAITING sets start and completion timestamps together. Complete from IN_CONSULTATION keeps existing start/`consulted_by*`. Does not set CANCELLED. Does not release beds or close admissions. When `consultation_completed` is enabled, creates `consultation` notifications for admin and receptionist. Always removes any active waiting `queue` notification.",
        responses: {
          "200": {
            description: "Treatment completed successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Only waiting or in-consultation patients can be completed.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/doctor/patients/{pk}/cancel/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["Doctor"],
        summary: "Cancel consultation",
        operationId: "cancelConsultation",
        description:
          "IN_CONSULTATION → WAITING (not CANCELLED). Clears `consultation_started_at`. Does not clear `consulted_by*`. Always creates `consultation` notifications for admin and receptionist (cancelled) and recreates the admin waiting `queue` notification.",
        responses: {
          "200": {
            description: "Consultation cancelled. Patient returned to waiting queue.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PatientItemResponse" } } },
          },
          "400": {
            description: "Only in-progress consultations can be cancelled.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
          "404": { $ref: "#/components/responses/PatientNotFound" },
        },
      },
    },
    "/api/v1/queue/": {
      get: {
        tags: ["Queue"],
        summary: "Public queue status",
        operationId: "getPublicQueueStatus",
        security: [],
        description: [
          "Unauthenticated. JWT is ignored if sent.",
          "",
          "UTC today `[00:00:00.000Z, next midnight)`.",
          "`todays_token` is the latest patient created today (display `P0001`).",
          "`current_token` / `current_patient_name` prefer today’s earliest `IN_CONSULTATION`",
          "(`consultation_started_at`, then `created_at`); else today’s earliest `WAITING` by `created_at`.",
          "Completed patients drop out. Cancelled-back-to-waiting re-enter in original `created_at` order.",
          "Empty clinic day: all three strings are `\"\"`.",
        ].join("\n"),
        responses: {
          "200": {
            description: "Queue status retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QueueStatusResponse" },
                examples: {
                  empty: {
                    summary: "No patients created today",
                    value: {
                      success: true,
                      message: "Queue status retrieved successfully.",
                      data: {
                        todays_token: "",
                        current_token: "",
                        current_patient_name: "",
                      },
                    },
                  },
                  live: {
                    summary: "Consultation in progress",
                    value: {
                      success: true,
                      message: "Queue status retrieved successfully.",
                      data: {
                        todays_token: "P0007",
                        current_token: "P0003",
                        current_patient_name: "Ada Lovelace",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/settings/": {
      get: {
        tags: ["Settings"],
        summary: "Get clinic settings",
        operationId: "getSettings",
        description:
          "Admin only. Returns the singleton clinic settings document, creating defaults if none exist. Does not change patient or queue records.",
        responses: {
          "200": {
            description: "Settings retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsSuccessResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/settings/clinic/": {
      patch: {
        tags: ["Settings"],
        summary: "Update clinic settings",
        operationId: "updateClinicSettings",
        description: "Admin only. Updates clinic name, phone, email, address, working days, and hours.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ClinicSettings" },
              example: {
                name: "Doctor Clinic",
                phone: "+91 98765 43210",
                email: "clinic@example.com",
                address: "123, Health Street, Medical Road",
                working_days: "MONDAY_SATURDAY",
                opening_time: "09:00",
                closing_time: "18:00",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Clinic settings updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failure.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/settings/queue/": {
      patch: {
        tags: ["Settings"],
        summary: "Update queue and token settings",
        operationId: "updateQueueSettings",
        description:
          "Admin only. Stores token format and queue hours. Does not rewrite existing patient tokens.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QueueSettings" },
              example: {
                token_format: "01",
                daily_token_reset: true,
                queue_start_time: "09:00",
                queue_end_time: "18:00",
                max_daily_tokens: 200,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Queue settings updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failure.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/settings/notifications/": {
      patch: {
        tags: ["Settings"],
        summary: "Update notification settings",
        operationId: "updateNotificationSettings",
        description:
          "Admin only. Toggles whether clinic events create inbox notifications for staff (`patient`, `token`, `consultation`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NotificationSettings" },
              example: {
                patient_registration: true,
                token_generated: true,
                token_approaching: true,
                consultation_completed: true,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Notification settings updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failure.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/settings/preferences/": {
      patch: {
        tags: ["Settings"],
        summary: "Update system preferences",
        operationId: "updatePreferenceSettings",
        description: "Admin only. Date format, time format, timezone, and language.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PreferenceSettings" },
              example: {
                date_format: "DD/MM/YYYY",
                time_format: "12_HOUR",
                timezone: "Asia/Kolkata",
                language: "en",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "System preferences updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failure.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/notifications/": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications",
        operationId: "listNotifications",
        description:
          "Admin or receptionist. Returns the logged-in user's role-relevant notifications, newest first. Receptionists see patient events plus consultation started, completed, and cancelled. Admins see patient, queue, consultation, staff, and system events. Optional `type` and `is_read` filters.",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["patient", "token", "queue", "consultation", "staff", "system"],
            },
          },
          {
            name: "is_read",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["true", "false", "1", "0"] },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "page_size",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
          },
        ],
        responses: {
          "200": {
            description: "Notifications retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotificationListResponse" },
              },
            },
          },
          "400": {
            description: "Invalid type or is_read filter.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenNotifications" },
        },
      },
    },
    "/api/v1/notifications/unread-count/": {
      get: {
        tags: ["Notifications"],
        summary: "Unread notification count",
        operationId: "getUnreadNotificationCount",
        description: "Admin or receptionist. Count of unread notifications for the logged-in user.",
        responses: {
          "200": {
            description: "Unread notification count retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotificationUnreadCountResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenNotifications" },
        },
      },
    },
    "/api/v1/notifications/read-all/": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        operationId: "markAllNotificationsRead",
        description: "Admin or receptionist. Marks every unread notification owned by the logged-in user as read.",
        responses: {
          "200": {
            description: "All notifications marked as read.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotificationMarkAllResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenNotifications" },
        },
      },
    },
    "/api/v1/notifications/{id}/read/": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark notification as read",
        operationId: "markNotificationRead",
        description: "Admin or receptionist. Marks one of the logged-in user's notifications as read. Idempotent.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Notification MongoDB ObjectId.",
          },
        ],
        responses: {
          "200": {
            description: "Notification marked as read.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotificationItemResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenNotifications" },
          "404": { $ref: "#/components/responses/NotificationNotFound" },
        },
      },
    },
    "/api/v1/notifications/{id}/": {
      delete: {
        tags: ["Notifications"],
        summary: "Delete notification",
        operationId: "deleteNotification",
        description: "Admin or receptionist. Deletes one notification owned by the logged-in user.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Notification MongoDB ObjectId.",
          },
        ],
        responses: {
          "200": {
            description: "Notification deleted successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessageResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenNotifications" },
          "404": { $ref: "#/components/responses/NotificationNotFound" },
        },
      },
    },
    "/api/v1/reports/": {
      get: {
        tags: ["Reports"],
        summary: "Historical clinic reports",
        operationId: "getReports",
        description:
          "Admin only. Date-range analytics (KPIs vs previous period, visit trend, consultation mix, queue totals, receptionist activity, paginated visits). Defaults to the last 30 UTC days. Dashboard live stats are unchanged.",
        parameters: [
          {
            name: "start_date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date", example: "2026-07-22" },
            description: "Inclusive UTC start date (YYYY-MM-DD). Required with end_date.",
          },
          {
            name: "end_date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date", example: "2026-08-20" },
            description: "Inclusive UTC end date (YYYY-MM-DD). Required with start_date. Max 366 days.",
          },
          {
            name: "table",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["visits", "consultations"], default: "visits" },
            description: "`consultations` limits the visits table to completed and in-consultation records.",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED"],
            },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "page_size",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
          },
        ],
        responses: {
          "200": {
            description: "Reports retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReportsSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid date range, status, or pagination.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/reports/export/": {
      get: {
        tags: ["Reports"],
        summary: "Export report visits as CSV",
        operationId: "exportReports",
        description:
          "Admin only. CSV of visits in the selected range (max 5000 rows). Uses the same date/table/status filters as GET /api/v1/reports/.",
        parameters: [
          {
            name: "start_date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
          {
            name: "end_date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
          {
            name: "table",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["visits", "consultations"] },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "CSV download.",
            content: {
              "text/csv": {
                schema: { type: "string" },
                example:
                  "Date,Patient,Patient ID,Token,Visit,Status,Registered By\n2026-08-20,Asha Patel,P1001,P0001,1,COMPLETED,Harshad Kakadiya\n",
              },
            },
          },
          "400": {
            description: "Invalid date range or status.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAdmin" },
        },
      },
    },
    "/api/v1/rooms/": {
      get: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "List rooms",
        operationId: "listRooms",
        description:
          "Admin or receptionist. Paginated rooms. `available_count` and `bed_count` are computed from current bed statuses.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "room_type", in: "query", schema: { $ref: "#/components/schemas/RoomType" } },
          { name: "floor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Rooms retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RoomListResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewBeds" },
        },
      },
      post: {
        tags: ["Admin Bed Management"],
        summary: "Create room",
        operationId: "createRoom",
        description: "Admin only (`canManageBeds`). Creates a room. Receptionist is forbidden.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RoomWriteRequest" } } },
        },
        responses: {
          "201": {
            description: "Room created successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RoomItemResponse" } } },
          },
          "400": {
            description: "Validation failed.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
        },
      },
    },
    "/api/v1/rooms/{pk}/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "Get room with beds",
        operationId: "getRoom",
        description: "Admin or receptionist. Room details plus all beds in that room.",
        responses: {
          "200": {
            description: "Room retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RoomDetailResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewBeds" },
          "404": { $ref: "#/components/responses/RoomNotFound" },
        },
      },
      put: {
        tags: ["Admin Bed Management"],
        summary: "Update room",
        description: "Admin only (`canManageBeds`).",
        operationId: "updateRoom",
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/RoomWriteRequest" } } },
        },
        responses: {
          "200": {
            description: "Room updated successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RoomItemResponse" } } },
          },
          "400": {
            description: "Validation failed or capacity is below existing bed count.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
          "404": { $ref: "#/components/responses/RoomNotFound" },
        },
      },
      delete: {
        tags: ["Admin Bed Management"],
        summary: "Delete room",
        operationId: "deleteRoom",
        description:
          "Admin only (`canManageBeds`). Deletes the room and its unoccupied beds. Occupied or reserved beds block deletion.",
        responses: {
          "200": {
            description: "Room deleted successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessageResponse" } } },
          },
          "400": {
            description: "Room has occupied or reserved beds.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
          "404": { $ref: "#/components/responses/RoomNotFound" },
        },
      },
    },
    "/api/v1/beds/": {
      get: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "List beds",
        operationId: "listBeds",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
          { name: "room_id", in: "query", schema: { type: "string" } },
          { name: "patient_id", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/BedStatus" } },
        ],
        responses: {
          "200": {
            description: "Beds retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedListResponse" } } },
          },
          "400": {
            description: "Invalid room_id, patient_id, or status.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewBeds" },
        },
      },
      post: {
        tags: ["Admin Bed Management"],
        summary: "Create bed",
        operationId: "createBed",
        description:
          "Admin only (`canManageBeds`). Creates a bed in a room. Rejected when the room is at capacity. Occupied status is not allowed at create time.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BedWriteRequest" } } },
        },
        responses: {
          "201": {
            description: "Bed created successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedItemResponse" } } },
          },
          "400": {
            description: "Validation failed, duplicate bed number, or room at capacity.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
          "404": { $ref: "#/components/responses/RoomNotFound" },
        },
      },
    },
    "/api/v1/beds/available/": {
      get: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "List available beds",
        operationId: "listAvailableBeds",
        description: "Admin or receptionist. Beds whose current status is `available`. Count is not stored.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
          { name: "room_id", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Available beds retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedListResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewBeds" },
        },
      },
    },
    "/api/v1/beds/summary/": {
      get: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "Bed status counts",
        operationId: "getBedSummary",
        description: "Admin or receptionist. Totals are aggregated from live bed statuses.",
        responses: {
          "200": {
            description: "Bed summary retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedSummaryResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewBeds" },
        },
      },
    },
    "/api/v1/beds/{pk}/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "Get bed",
        operationId: "getBed",
        responses: {
          "200": {
            description: "Bed retrieved successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedItemResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenViewBeds" },
          "404": { $ref: "#/components/responses/BedNotFound" },
        },
      },
      put: {
        tags: ["Admin Bed Management"],
        summary: "Update bed",
        operationId: "updateBed",
        description: "Admin only (`canManageBeds`).",
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/BedUpdateRequest" } } },
        },
        responses: {
          "200": {
            description: "Bed updated successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedItemResponse" } } },
          },
          "400": {
            description: "Validation failed or occupied status change is not allowed.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
          "404": { $ref: "#/components/responses/BedNotFound" },
        },
      },
      delete: {
        tags: ["Admin Bed Management"],
        summary: "Delete bed",
        operationId: "deleteBed",
        description: "Admin only (`canManageBeds`). Occupied or reserved beds cannot be deleted.",
        responses: {
          "200": {
            description: "Bed deleted successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessageResponse" } } },
          },
          "400": {
            description: "Bed is occupied or reserved.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
          "404": { $ref: "#/components/responses/BedNotFound" },
        },
      },
    },
    "/api/v1/beds/{pk}/assign/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "Assign bed to patient",
        operationId: "assignBed",
        description:
          "Admin or receptionist. Occupies an available bed for an inpatient who requires admission. Rejects occupied, reserved, maintenance, and blocked beds. A patient cannot hold two active beds.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["patient_id"],
                properties: { patient_id: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Bed assigned successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedItemResponse" } } },
          },
          "400": {
            description: "Bed not assignable or patient already assigned.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAssignBeds" },
          "404": { $ref: "#/components/responses/BedOrPatientNotFound" },
        },
      },
    },
    "/api/v1/beds/{pk}/release/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["Admin Bed Management", "Receptionist Bed Management"],
        summary: "Release bed",
        operationId: "releaseBed",
        description: "Admin or receptionist (`canAssignBeds`). Clears occupancy and sets status to available.",
        responses: {
          "200": {
            description: "Bed released successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedItemResponse" } } },
          },
          "400": {
            description: "Bed is not occupied or reserved.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenAssignBeds" },
          "404": { $ref: "#/components/responses/BedNotFound" },
        },
      },
    },
    "/api/v1/beds/{pk}/status/": {
      parameters: [{ name: "pk", in: "path", required: true, schema: { type: "string" } }],
      patch: {
        tags: ["Admin Bed Management"],
        summary: "Update bed status",
        operationId: "updateBedStatus",
        description:
          "Admin only (`canManageBeds`). Cannot set occupied here (use assign). Occupied beds must be released first.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: { status: { $ref: "#/components/schemas/BedStatus" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Bed status updated successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BedItemResponse" } } },
          },
          "400": {
            description: "Invalid status transition.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenManageBeds" },
          "404": { $ref: "#/components/responses/BedNotFound" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "HS256 access token from `POST /api/v1/auth/login/` or `POST /api/v1/auth/token/refresh/`. Send as `Authorization: Bearer <access>`.",
      },
    },
    responses: {
      Unauthorized: {
        description:
          "Missing, invalid, expired, inactive, or deleted user JWT. DRF `{ detail }` shape — not the business envelope.",
        headers: {
          "WWW-Authenticate": {
            schema: { type: "string", example: 'Bearer realm="api"' },
          },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            examples: {
              missing: {
                summary: "No Authorization header",
                value: { detail: "Authentication credentials were not provided." },
              },
              invalid: {
                summary: "Invalid or expired access token",
                value: { detail: "Token is invalid or expired." },
              },
              userNotFound: {
                summary: "User missing for token",
                value: { detail: "User not found" },
              },
              inactive: {
                summary: "Inactive user",
                value: { detail: "User is inactive" },
              },
            },
          },
        },
      },
      ForbiddenAdmin: {
        description: "Authenticated but not ADMIN. DRF `{ detail }`.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "Admin access required." },
          },
        },
      },
      ReceptionistNotFound: {
        description: "Unknown, invalid, admin, or soft-deleted id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            example: { success: false, message: "Receptionist not found." },
          },
        },
      },
      PatientNotFound: {
        description: "Unknown or invalid patient id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            example: { success: false, message: "Patient not found." },
          },
        },
      },
      ForbiddenNotifications: {
        description: "Authenticated user cannot access notifications.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "You do not have permission to view notifications." },
          },
        },
      },
      NotificationNotFound: {
        description: "Unknown, invalid, or another user's notification id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            example: { success: false, message: "Notification not found." },
          },
        },
      },
      ForbiddenViewBeds: {
        description: "Authenticated user cannot view rooms and beds.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "You do not have permission to view rooms and beds." },
          },
        },
      },
      ForbiddenAssignBeds: {
        description: "Authenticated user cannot assign or release beds.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "You do not have permission to assign or release beds." },
          },
        },
      },
      ForbiddenManageBeds: {
        description: "Non-admin cannot create, update, or delete rooms/beds or change bed status.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "Only administrators can manage rooms and beds." },
          },
        },
      },
      RoomNotFound: {
        description: "Unknown or invalid room id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            example: { success: false, message: "Room not found." },
          },
        },
      },
      BedNotFound: {
        description: "Unknown or invalid bed id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            example: { success: false, message: "Bed not found." },
          },
        },
      },
      BedOrPatientNotFound: {
        description: "Unknown or invalid bed or patient id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            example: { success: false, message: "Patient not found." },
          },
        },
      },
      ForbiddenViewPatients: {
        description: "Wrong role for viewing patients.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "You do not have permission to view patients." },
          },
        },
      },
      ForbiddenCreatePatients: {
        description: "Wrong role for registering patients.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "You do not have permission to register patients." },
          },
        },
      },
      ForbiddenUpdatePatients: {
        description: "Wrong role for updating patients.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "You do not have permission to update patients." },
          },
        },
      },
      ForbiddenDeletePatients: {
        description: "Non-admin cannot delete patients.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DetailError" },
            example: { detail: "Only administrators can delete patients." },
          },
        },
      },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        required: ["status", "database"],
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["ok"] },
          database: { type: "string", enum: ["connected", "disconnected"] },
        },
      },
      User: {
        type: "object",
        required: [
          "id",
          "full_name",
          "email",
          "mobile",
          "role",
          "is_active",
          "last_login",
          "created_at",
          "updated_at",
        ],
        additionalProperties: false,
        description:
          "UserSerializer. Does not include password, gender, or is_deleted. Datetimes are Django-like ISO-8601 (often without Z).",
        properties: {
          id: { type: "string", description: "MongoDB ObjectId hex string" },
          full_name: { type: "string" },
          email: { type: "string", format: "email" },
          mobile: { type: "string", description: "10-digit mobile when set; empty string otherwise." },
          role: { type: "string", enum: ["ADMIN", "RECEPTIONIST"] },
          is_active: { type: "boolean" },
          last_login: { type: "string", nullable: true },
          created_at: { type: "string", nullable: true },
          updated_at: { type: "string", nullable: true },
        },
      },
      UpdateMeRequest: {
        type: "object",
        additionalProperties: true,
        description: "Partial profile update. Only full_name and mobile are applied.",
        properties: {
          full_name: { type: "string", maxLength: 255 },
          mobile: {
            type: "string",
            description: "10-digit mobile number, or blank to clear.",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password", writeOnly: true },
        },
      },
      LoginData: {
        type: "object",
        required: ["access", "refresh", "user"],
        properties: {
          access: { type: "string", description: "HS256 JWT access token" },
          refresh: { type: "string", description: "HS256 JWT refresh token" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      LoginSuccessResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: "Login successful." },
          data: { $ref: "#/components/schemas/LoginData" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refresh"],
        properties: {
          refresh: { type: "string", description: "JWT refresh token" },
        },
      },
      RefreshData: {
        type: "object",
        required: ["access", "refresh"],
        properties: {
          access: { type: "string" },
          refresh: { type: "string" },
        },
      },
      RefreshSuccessResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: "Token refreshed successfully." },
          data: { $ref: "#/components/schemas/RefreshData" },
        },
      },
      MeSuccessResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: "User retrieved successfully." },
          data: {
            type: "object",
            required: ["user"],
            properties: {
              user: { $ref: "#/components/schemas/User" },
            },
          },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["current_password", "new_password", "confirm_password"],
        properties: {
          current_password: { type: "string", format: "password", writeOnly: true },
          new_password: { type: "string", format: "password", writeOnly: true },
          confirm_password: { type: "string", format: "password", writeOnly: true },
        },
      },
      MessageSuccessResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
        },
        description: "Success envelope with no `data` field (logout, change-password).",
      },
      ErrorEnvelope: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", enum: [false] },
          message: { type: "string" },
          errors: {
            type: "object",
            additionalProperties: true,
            description:
              "Usually DRF field maps `{ field: [\"msg\"] }`. Refresh 401 uses `{ detail, code }`. Omitted when not provided.",
          },
        },
      },
      DetailError: {
        type: "object",
        required: ["detail"],
        additionalProperties: false,
        properties: {
          detail: { type: "string" },
        },
        description: "DRF unauthenticated/forbidden body used for JWT failures.",
      },
      Receptionist: {
        type: "object",
        additionalProperties: false,
        description: "ReceptionistSerializer. No role, password, or is_deleted.",
        required: [
          "id",
          "full_name",
          "email",
          "mobile",
          "gender",
          "is_active",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string" },
          full_name: { type: "string" },
          email: { type: "string", format: "email" },
          mobile: { type: "string", description: "Empty string if null" },
          gender: { type: "string", description: "Empty string if null" },
          is_active: { type: "boolean" },
          created_at: { type: "string", nullable: true },
          updated_at: { type: "string", nullable: true },
        },
      },
      ReceptionistCreateRequest: {
        type: "object",
        required: ["full_name", "email", "mobile", "password", "confirm_password", "gender"],
        properties: {
          full_name: { type: "string", maxLength: 255 },
          email: { type: "string", format: "email" },
          mobile: { type: "string", maxLength: 20 },
          password: { type: "string", format: "password", writeOnly: true },
          confirm_password: { type: "string", format: "password", writeOnly: true },
          gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
        },
      },
      ReceptionistUpdateRequest: {
        type: "object",
        properties: {
          full_name: { type: "string", maxLength: 255 },
          email: { type: "string", format: "email" },
          mobile: { type: "string", maxLength: 20 },
          gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
        },
      },
      PaginationMeta: {
        type: "object",
        required: ["page", "page_size", "total", "total_pages", "has_next", "has_previous"],
        properties: {
          page: { type: "integer" },
          page_size: { type: "integer" },
          total: { type: "integer" },
          total_pages: { type: "integer" },
          has_next: { type: "boolean" },
          has_previous: { type: "boolean" },
        },
      },
      Notification: {
        type: "object",
        required: [
          "id",
          "user_id",
          "type",
          "title",
          "message",
          "is_read",
          "read_at",
          "related_id",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string" },
          user_id: { type: "string" },
          type: {
            type: "string",
            enum: ["patient", "token", "queue", "consultation", "staff", "system"],
          },
          title: { type: "string" },
          message: { type: "string" },
          is_read: { type: "boolean" },
          read_at: { type: "string", nullable: true },
          related_id: { type: "string" },
          patient_name: { type: "string" },
          token_number: { type: "string" },
          visit_number: { type: "integer", nullable: true },
          created_at: { type: "string", nullable: true },
          updated_at: { type: "string", nullable: true },
        },
      },
      NotificationListResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: "Notifications retrieved successfully." },
          data: {
            type: "object",
            required: ["results", "pagination"],
            properties: {
              results: { type: "array", items: { $ref: "#/components/schemas/Notification" } },
              pagination: { $ref: "#/components/schemas/PaginationMeta" },
            },
          },
        },
      },
      NotificationItemResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["notification"],
            properties: {
              notification: { $ref: "#/components/schemas/Notification" },
            },
          },
        },
      },
      NotificationUnreadCountResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["unread_count"],
            properties: {
              unread_count: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      NotificationMarkAllResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["updated"],
            properties: {
              updated: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      SuccessMessageResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
        },
      },
      ReceptionistListResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: "Receptionists retrieved successfully." },
          data: {
            type: "object",
            required: ["results", "pagination"],
            properties: {
              results: { type: "array", items: { $ref: "#/components/schemas/Receptionist" } },
              pagination: { $ref: "#/components/schemas/PaginationMeta" },
            },
          },
        },
      },
      ReceptionistItemResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["receptionist"],
            properties: {
              receptionist: { $ref: "#/components/schemas/Receptionist" },
            },
          },
        },
      },
      Patient: {
        type: "object",
        description: "PatientSerializer. token_number is display format (P0001).",
        properties: {
          id: { type: "string" },
          patient_id: {
            type: "string",
            description: "Permanent patient identity. Shared across visits. Visit documents still use id.",
          },
          token_number: { type: "string", example: "P0001" },
          visit_number: { type: "integer" },
          patient_name: { type: "string" },
          mobile: { type: "string" },
          age: { type: "integer" },
          gender: { type: "string" },
          blood_group: { type: "string" },
          address: { type: "string" },
          chief_complaint: { type: "string" },
          status: { type: "string" },
          created_by: { type: "string" },
          created_by_name: { type: "string" },
          created_at: { type: "string", nullable: true },
          updated_at: { type: "string", nullable: true },
          completed_at: { type: "string", nullable: true },
          is_editable_by_receptionist: { type: "boolean" },
          is_editable_by_admin: { type: "boolean" },
          doctor_notes: { type: "string" },
          diagnosis: { type: "string" },
          prescription: { type: "string" },
          temperature: { type: "number", nullable: true },
          blood_pressure: { type: "string" },
          pulse: { type: "string" },
          weight: { type: "number", nullable: true },
          height: { type: "number", nullable: true },
          consultation_started_at: { type: "string", nullable: true },
          consultation_completed_at: { type: "string", nullable: true },
          consulted_by: { type: "string" },
          consulted_by_name: { type: "string" },
          updated_by: { type: "string" },
          updated_by_name: { type: "string" },
          care_type: { type: "string", description: "Outpatient or Inpatient. Empty until the doctor decides." },
          admission_status: {
            type: "string",
            description: "Not Required, Pending, Admitted, or Discharged. Empty until the doctor sets patient type. Legacy Admission Required is returned as Pending.",
          },
          admitted_at: { type: "string", nullable: true },
          discharged_at: { type: "string", nullable: true },
          assigned_bed: {
            type: "object",
            nullable: true,
            description: "Active bed for an admitted patient, formatted as Room 101 · Bed 101-A.",
            properties: {
              room_number: { type: "string" },
              bed_number: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
      PatientCreateRequest: {
        type: "object",
        required: ["patient_name", "mobile", "age", "gender", "chief_complaint"],
        properties: {
          patient_name: { type: "string", maxLength: 255 },
          mobile: { type: "string", maxLength: 20 },
          age: { type: "integer", minimum: 0, maximum: 150 },
          gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
          blood_group: { type: "string" },
          address: { type: "string" },
          chief_complaint: { type: "string" },
          patient_id: {
            type: "string",
            description: "Optional. When set, creates a new visit for this permanent Patient ID.",
          },
        },
      },
      PatientUpdateRequest: {
        type: "object",
        properties: {
          patient_name: { type: "string", maxLength: 255 },
          mobile: { type: "string", maxLength: 20 },
          age: { type: "integer", minimum: 0, maximum: 150 },
          gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
          blood_group: { type: "string" },
          address: { type: "string" },
          chief_complaint: { type: "string" },
        },
      },
      ConsultationSaveRequest: {
        type: "object",
        description: "All fields optional. Floats allow null. Char fields allow blank; null is invalid.",
        properties: {
          temperature: { type: "number", nullable: true },
          blood_pressure: { type: "string", maxLength: 20 },
          pulse: { type: "string", maxLength: 20 },
          weight: { type: "number", nullable: true },
          height: { type: "number", nullable: true },
          diagnosis: { type: "string" },
          doctor_notes: { type: "string" },
          prescription: { type: "string" },
        },
      },
      PatientListResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              results: { type: "array", items: { $ref: "#/components/schemas/Patient" } },
              pagination: { $ref: "#/components/schemas/PaginationMeta" },
            },
          },
        },
      },
      PatientItemResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              patient: { $ref: "#/components/schemas/Patient" },
            },
          },
        },
      },
      PatientStatsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["waiting", "in_consultation", "completed", "completed_today", "today"],
            properties: {
              waiting: { type: "integer" },
              in_consultation: { type: "integer" },
              completed: { type: "integer" },
              completed_today: { type: "integer" },
              today: { type: "integer" },
            },
          },
        },
      },
      PatientLookupResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: { type: "object", additionalProperties: true },
        },
      },
      QueueStatusResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: "Queue status retrieved successfully." },
          data: {
            type: "object",
            required: ["todays_token", "current_token", "current_patient_name"],
            additionalProperties: false,
            properties: {
              todays_token: {
                type: "string",
                description: "Display token of the latest patient created today, or empty.",
                example: "P0007",
              },
              current_token: {
                type: "string",
                description:
                  "Display token of current IN_CONSULTATION or queue-head WAITING patient today, or empty.",
                example: "P0003",
              },
              current_patient_name: { type: "string", example: "Ada Lovelace" },
            },
          },
        },
      },
      ClinicSettings: {
        type: "object",
        required: [
          "name",
          "phone",
          "email",
          "address",
          "working_days",
          "opening_time",
          "closing_time",
        ],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string", format: "email" },
          address: { type: "string" },
          working_days: {
            type: "string",
            enum: ["MONDAY_FRIDAY", "MONDAY_SATURDAY", "EVERY_DAY"],
          },
          opening_time: { type: "string", example: "09:00" },
          closing_time: { type: "string", example: "18:00" },
        },
      },
      QueueSettings: {
        type: "object",
        required: [
          "token_format",
          "daily_token_reset",
          "queue_start_time",
          "queue_end_time",
        ],
        properties: {
          token_format: { type: "string", example: "01" },
          daily_token_reset: { type: "boolean" },
          queue_start_time: { type: "string", example: "09:00" },
          queue_end_time: { type: "string", example: "18:00" },
          max_daily_tokens: { type: "integer", nullable: true, minimum: 1, maximum: 9999 },
        },
      },
      NotificationSettings: {
        type: "object",
        required: [
          "patient_registration",
          "token_generated",
          "token_approaching",
          "consultation_completed",
        ],
        properties: {
          patient_registration: { type: "boolean" },
          token_generated: { type: "boolean" },
          token_approaching: { type: "boolean" },
          consultation_completed: { type: "boolean" },
        },
      },
      PreferenceSettings: {
        type: "object",
        required: ["date_format", "time_format", "timezone", "language"],
        properties: {
          date_format: { type: "string", enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] },
          time_format: { type: "string", enum: ["12_HOUR", "24_HOUR"] },
          timezone: {
            type: "string",
            enum: ["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London", "America/New_York"],
          },
          language: { type: "string", enum: ["en", "hi", "gu"] },
        },
      },
      SettingsDocument: {
        type: "object",
        required: ["clinic", "queue", "notifications", "preferences", "updated_at"],
        properties: {
          clinic: { $ref: "#/components/schemas/ClinicSettings" },
          queue: { $ref: "#/components/schemas/QueueSettings" },
          notifications: { $ref: "#/components/schemas/NotificationSettings" },
          preferences: { $ref: "#/components/schemas/PreferenceSettings" },
          updated_at: { type: "string", nullable: true },
        },
      },
      SettingsSuccessResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["settings"],
            properties: {
              settings: { $ref: "#/components/schemas/SettingsDocument" },
            },
          },
        },
      },
      ReportKpi: {
        type: "object",
        required: ["value", "previous", "change_percent"],
        properties: {
          value: { type: "integer" },
          previous: { type: "integer" },
          change_percent: { type: "number" },
        },
      },
      ReportVisit: {
        type: "object",
        properties: {
          id: { type: "string" },
          created_at: { type: "string", nullable: true },
          patient_name: { type: "string" },
          patient_id: { type: "string" },
          token_number: { type: "string" },
          visit_number: { type: "integer" },
          status: { type: "string" },
          created_by_name: { type: "string" },
          chief_complaint: { type: "string" },
          diagnosis: { type: "string" },
          consulted_by_name: { type: "string" },
          consultation_started_at: { type: "string", nullable: true },
          consultation_completed_at: { type: "string", nullable: true },
        },
      },
      ReportsSuccessResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: [
              "range",
              "kpis",
              "visits_trend",
              "consultation_status",
              "visits",
              "queue",
              "receptionists",
              "daily_comparison",
            ],
            properties: {
              range: {
                type: "object",
                properties: {
                  start_date: { type: "string", format: "date" },
                  end_date: { type: "string", format: "date" },
                  previous_start_date: { type: "string", format: "date" },
                  previous_end_date: { type: "string", format: "date" },
                  day_count: { type: "integer" },
                },
              },
              kpis: {
                type: "object",
                properties: {
                  total_visits: { $ref: "#/components/schemas/ReportKpi" },
                  unique_patients: { $ref: "#/components/schemas/ReportKpi" },
                  consultations: { $ref: "#/components/schemas/ReportKpi" },
                  cancelled_visits: { $ref: "#/components/schemas/ReportKpi" },
                },
              },
              visits_trend: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", format: "date" },
                    visits: { type: "integer" },
                  },
                },
              },
              consultation_status: {
                type: "object",
                properties: {
                  completed: { type: "integer" },
                  cancelled: { type: "integer" },
                  waiting: { type: "integer" },
                  in_consultation: { type: "integer" },
                  total: { type: "integer" },
                },
              },
              visits: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ReportVisit" },
                  },
                  pagination: { $ref: "#/components/schemas/PaginationMeta" },
                },
              },
              queue: {
                type: "object",
                properties: {
                  total_tokens: { type: "integer" },
                  completed_tokens: { type: "integer" },
                  cancelled_tokens: { type: "integer" },
                  waiting_tokens: { type: "integer" },
                  in_consultation_tokens: { type: "integer" },
                  average_waiting_minutes: { type: "integer", nullable: true },
                },
              },
              receptionists: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", nullable: true },
                    full_name: { type: "string" },
                    patients_registered: { type: "integer" },
                    visits_created: { type: "integer" },
                  },
                },
              },
              daily_comparison: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", format: "date" },
                    previous_date: { type: "string", format: "date" },
                    this_period: { type: "integer" },
                    previous_period: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      RoomType: {
        type: "string",
        enum: ["GENERAL", "PRIVATE", "SEMI_PRIVATE", "ICU", "EMERGENCY", "WARD", "OTHER"],
      },
      BedStatus: {
        type: "string",
        enum: ["available", "occupied", "reserved", "maintenance", "blocked"],
      },
      Room: {
        type: "object",
        required: [
          "id",
          "room_number",
          "room_type",
          "floor",
          "capacity",
          "notes",
          "bed_count",
          "available_count",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string" },
          room_number: { type: "string" },
          room_type: { $ref: "#/components/schemas/RoomType" },
          floor: { type: "string" },
          capacity: { type: "integer", minimum: 1, maximum: 200 },
          notes: { type: "string" },
          bed_count: { type: "integer", description: "Computed from beds in the room." },
          available_count: { type: "integer", description: "Computed from beds with status available." },
          created_at: { type: "string", nullable: true },
          updated_at: { type: "string", nullable: true },
        },
      },
      Bed: {
        type: "object",
        required: [
          "id",
          "room_id",
          "bed_number",
          "status",
          "patient_id",
          "assigned_at",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string" },
          room_id: { type: "string" },
          bed_number: { type: "string" },
          status: { $ref: "#/components/schemas/BedStatus" },
          patient_id: { type: "string", nullable: true },
          assigned_at: { type: "string", nullable: true },
          created_at: { type: "string", nullable: true },
          updated_at: { type: "string", nullable: true },
        },
      },
      RoomWriteRequest: {
        type: "object",
        properties: {
          room_number: { type: "string" },
          room_type: { $ref: "#/components/schemas/RoomType" },
          floor: { type: "string" },
          capacity: { type: "integer", minimum: 1, maximum: 200 },
          notes: { type: "string" },
        },
      },
      BedWriteRequest: {
        type: "object",
        required: ["room_id", "bed_number"],
        properties: {
          room_id: { type: "string" },
          bed_number: { type: "string" },
          status: { $ref: "#/components/schemas/BedStatus" },
        },
      },
      BedUpdateRequest: {
        type: "object",
        properties: {
          bed_number: { type: "string" },
          status: { $ref: "#/components/schemas/BedStatus" },
        },
      },
      RoomListResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["results", "pagination"],
            properties: {
              results: { type: "array", items: { $ref: "#/components/schemas/Room" } },
              pagination: { $ref: "#/components/schemas/PaginationMeta" },
            },
          },
        },
      },
      RoomItemResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["room"],
            properties: { room: { $ref: "#/components/schemas/Room" } },
          },
        },
      },
      RoomDetailResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["room", "beds"],
            properties: {
              room: { $ref: "#/components/schemas/Room" },
              beds: { type: "array", items: { $ref: "#/components/schemas/Bed" } },
            },
          },
        },
      },
      BedListResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["results", "pagination"],
            properties: {
              results: { type: "array", items: { $ref: "#/components/schemas/Bed" } },
              pagination: { $ref: "#/components/schemas/PaginationMeta" },
            },
          },
        },
      },
      BedItemResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["bed"],
            properties: { bed: { $ref: "#/components/schemas/Bed" } },
          },
        },
      },
      BedSummaryResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data: {
            type: "object",
            required: ["summary"],
            properties: {
              summary: {
                type: "object",
                required: ["total", "available", "occupied", "reserved", "maintenance", "blocked"],
                properties: {
                  total: { type: "integer" },
                  available: { type: "integer" },
                  occupied: { type: "integer" },
                  reserved: { type: "integer" },
                  maintenance: { type: "integer" },
                  blocked: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  },
};
