import type { NextFunction, Request, RequestHandler, Response } from "express";

import { findUserForAuth } from "../auth/findUserForAuth";
import { verifyAccessToken } from "../auth/jwt";
import type { AuthenticatedUser } from "../auth/types";
import { detailResponse } from "../http/responses";

const BEARER_PREFIX = "Bearer ";
const WWW_AUTHENTICATE = 'Bearer realm="api"';

export type AuthenticateDependencies = {
  verifyToken?: typeof verifyAccessToken;
  loadUser?: (userId: string) => Promise<AuthenticatedUser | null>;
};

function unauthorized(res: Response, detail: string): Response {
  res.setHeader("WWW-Authenticate", WWW_AUTHENTICATE);
  return detailResponse(res, detail, 401);
}

function readBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  if (!header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}

export function createAuthenticateMiddleware(
  deps: AuthenticateDependencies = {},
): RequestHandler {
  const verifyToken = deps.verifyToken ?? verifyAccessToken;
  const loadUser = deps.loadUser ?? findUserForAuth;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.header("authorization") ?? req.header("Authorization");
    const token = readBearerToken(header);
    if (!token) {
      unauthorized(res, "Authentication credentials were not provided.");
      return;
    }

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.user_id;
    } catch {
      unauthorized(res, "Token is invalid or expired.");
      return;
    }

    const user = await loadUser(userId);
    if (!user || user.is_deleted) {
      unauthorized(res, "User not found");
      return;
    }

    if (!user.is_active) {
      unauthorized(res, "User is inactive");
      return;
    }

    req.user = user;
    next();
  };
}

export const authenticate = createAuthenticateMiddleware();
