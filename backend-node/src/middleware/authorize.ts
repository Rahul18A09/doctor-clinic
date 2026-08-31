import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { AuthenticatedUser } from "../auth/types";
import { UserRole, type UserRole as Role } from "../constants";
import { PermissionMessage } from "../http/errors";
import { detailResponse } from "../http/responses";

const WWW_AUTHENTICATE = 'Bearer realm="api"';

function defaultForbiddenMessage(allowed: readonly Role[]): string {
  if (allowed.length === 1 && allowed[0] === UserRole.ADMIN) {
    return PermissionMessage.admin;
  }
  if (allowed.length === 1 && allowed[0] === UserRole.RECEPTIONIST) {
    return PermissionMessage.receptionist;
  }
  return PermissionMessage.authenticationRequired;
}

function unauthorized(res: Response): Response {
  res.setHeader("WWW-Authenticate", WWW_AUTHENTICATE);
  return detailResponse(res, "Authentication credentials were not provided.", 401);
}

function forbidden(res: Response, detail: string): Response {
  return detailResponse(res, detail, 403);
}

/**
 * Allow only the given roles. Role is taken from `req.user` (MongoDB),
 * never from headers, query, or body.
 */
export function requirePermission(
  message: string,
  ...allowedRoles: Role[]
): RequestHandler {
  const allowed = new Set(allowedRoles);

  return (req: Request, res: Response, next: NextFunction): void => {
    const user: AuthenticatedUser | undefined = req.user;
    if (!user) {
      unauthorized(res);
      return;
    }

    if (!allowed.has(user.role)) {
      forbidden(res, message);
      return;
    }

    next();
  };
}

export function requireRoles(...allowedRoles: Role[]): RequestHandler {
  return requirePermission(defaultForbiddenMessage(allowedRoles), ...allowedRoles);
}

export const requireAdmin = requireRoles(UserRole.ADMIN);
export const requireReceptionist = requireRoles(UserRole.RECEPTIONIST);
export const requireAdminOrReceptionist = requireRoles(
  UserRole.ADMIN,
  UserRole.RECEPTIONIST,
);

export const canViewPatients = requirePermission(
  PermissionMessage.viewPatients,
  UserRole.ADMIN,
  UserRole.RECEPTIONIST,
);
export const canCreatePatients = requirePermission(
  PermissionMessage.createPatients,
  UserRole.ADMIN,
  UserRole.RECEPTIONIST,
);
export const canUpdatePatients = requirePermission(
  PermissionMessage.updatePatients,
  UserRole.ADMIN,
  UserRole.RECEPTIONIST,
);
export const canDeletePatients = requirePermission(
  PermissionMessage.deletePatients,
  UserRole.ADMIN,
);
export const canAccessNotifications = requirePermission(
  PermissionMessage.viewNotifications,
  UserRole.ADMIN,
  UserRole.RECEPTIONIST,
);
