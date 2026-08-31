import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../auth/jwt";
import { hashDjangoPassword, verifyDjangoPassword } from "../auth/password";
import { validateNewPassword } from "../auth/passwordValidation";
import { serializeUser } from "../auth/serializeUser";
import type { UserRole } from "../constants";
import { firstErrorMessage, hasFieldErrors, type FieldErrors } from "../http/errors";
import { errorResponse, successResponse } from "../http/responses";
import {
  collectFieldErrors,
  escapeRegex,
  isValidEmail,
  readBody as readJsonBody,
  readOptionalString,
  ValidationMessage,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { User } from "../models/user.model";

function readBody(req: Request): Record<string, unknown> {
  return readJsonBody(req.body);
}

/** DRF CharField(required=True). Password uses trim_whitespace=False. */
function readRequiredChar(
  value: unknown,
  options: { trim?: boolean } = {},
): { value?: string; errors: string[] } {
  if (value === undefined) {
    return { errors: [ValidationMessage.required] };
  }
  if (value === null) {
    return { errors: [ValidationMessage.null] };
  }
  if (typeof value !== "string") {
    return { errors: ["Not a valid string."] };
  }
  if (options.trim === false) {
    if (value === "") {
      return { errors: [ValidationMessage.blank] };
    }
    return { value, errors: [] };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { errors: [ValidationMessage.blank] };
  }
  return { value: trimmed, errors: [] };
}

function tokensForUser(user: {
  _id: { toString(): string };
  email: string;
  full_name: string;
  role: UserRole;
}): { access: string; refresh: string } {
  const claims = {
    user_id: String(user._id),
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  };
  return {
    access: generateAccessToken(claims),
    refresh: generateRefreshToken(claims),
  };
}

async function findUserByEmail(email: string) {
  const exactInsensitive = await User.findOne({
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
  }).exec();
  if (exactInsensitive) {
    return exactInsensitive;
  }
  return User.findOne({ email }).exec();
}

const login: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const body = readBody(req);
  const errors: FieldErrors = {};

  const emailField = readRequiredChar(body["email"]);
  if (emailField.errors.length > 0) {
    errors.email = emailField.errors;
  } else if (emailField.value !== undefined && !isValidEmail(emailField.value)) {
    errors.email = [ValidationMessage.invalidEmail];
  }

  const passwordField = readRequiredChar(body["password"], { trim: false });
  if (passwordField.errors.length > 0) {
    errors.password = passwordField.errors;
  }

  if (Object.keys(errors).length > 0) {
    errorResponse(res, {
      message: firstErrorMessage(errors, "Login failed."),
      errors,
      statusCode: 400,
    });
    return;
  }

  const email = (emailField.value ?? "").toLowerCase();
  const password = passwordField.value ?? "";

  const user = await findUserByEmail(email);
  if (!user) {
    const fieldErrors: FieldErrors = {
      email: [`No account found with email '${email}'.`],
    };
    errorResponse(res, {
      message: firstErrorMessage(fieldErrors, "Login failed."),
      errors: fieldErrors,
      statusCode: 400,
    });
    return;
  }

  const passwordValid = await verifyDjangoPassword(password, user.password);
  if (!passwordValid) {
    const fieldErrors: FieldErrors = { password: ["Incorrect password."] };
    errorResponse(res, {
      message: firstErrorMessage(fieldErrors, "Login failed."),
      errors: fieldErrors,
      statusCode: 400,
    });
    return;
  }

  if (!user.is_active) {
    const fieldErrors: FieldErrors = {
      non_field_errors: ["This account has been deactivated."],
    };
    errorResponse(res, {
      message: firstErrorMessage(fieldErrors, "Login failed."),
      errors: fieldErrors,
      statusCode: 400,
    });
    return;
  }

  if (user.is_deleted) {
    const fieldErrors: FieldErrors = {
      non_field_errors: ["This account no longer exists."],
    };
    errorResponse(res, {
      message: firstErrorMessage(fieldErrors, "Login failed."),
      errors: fieldErrors,
      statusCode: 400,
    });
    return;
  }

  try {
    const now = new Date();
    user.last_login = now;
    await user.save();
    const tokens = tokensForUser(user);
    successResponse(res, {
      message: "Login successful.",
      data: {
        access: tokens.access,
        refresh: tokens.refresh,
        user: serializeUser(user),
      },
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    errorResponse(res, {
      message: `Token generation failed: ${detail}`,
      statusCode: 500,
    });
  }
};

const logout: RequestHandler = (_req: Request, res: Response): void => {
  successResponse(res, { message: "Logout successful." });
};

const me: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.user?.id).exec();
  if (!user || user.is_deleted) {
    errorResponse(res, { message: "User not found.", statusCode: 404 });
    return;
  }
  successResponse(res, {
    message: "User retrieved successfully.",
    data: { user: serializeUser(user) },
  });
};

const updateMe: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const body = readBody(req);
  const fullName = readOptionalString(body, "full_name", { maxLength: 255 });
  const mobile = readOptionalString(body, "mobile", { maxLength: 20, allowBlank: true });

  if (mobile.value && !/^[0-9]{10}$/.test(mobile.value)) {
    mobile.errors.push("Enter a valid 10-digit mobile number.");
  }

  const errors = collectFieldErrors({
    full_name: fullName,
    mobile,
  });
  if (hasFieldErrors(errors)) {
    errorResponse(res, {
      message: firstErrorMessage(errors, "Profile update failed."),
      errors,
      statusCode: 400,
    });
    return;
  }

  if (fullName.value === undefined && mobile.value === undefined) {
    errorResponse(res, {
      message: "Provide full_name or mobile.",
      statusCode: 400,
    });
    return;
  }

  const dbUser = await User.findById(req.user?.id).exec();
  if (!dbUser || dbUser.is_deleted) {
    errorResponse(res, { message: "User not found.", statusCode: 404 });
    return;
  }

  if (fullName.value !== undefined) {
    dbUser.full_name = fullName.value;
  }
  if (mobile.value !== undefined) {
    dbUser.mobile = mobile.value;
  }
  await dbUser.save();

  successResponse(res, {
    message: "Profile updated successfully.",
    data: { user: serializeUser(dbUser) },
  });
};

const refresh: RequestHandler = (req: Request, res: Response): void => {
  const body = readBody(req);
  if (!Object.prototype.hasOwnProperty.call(body, "refresh")) {
    errorResponse(res, {
      message: "Token refresh failed.",
      errors: { refresh: ["This field is required."] },
      statusCode: 400,
    });
    return;
  }

  const refreshToken = body["refresh"];
  if (typeof refreshToken !== "string" || refreshToken === "") {
    errorResponse(res, {
      message: "Token refresh failed.",
      errors: { refresh: ["This field may not be blank."] },
      statusCode: 400,
    });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const claims = {
      user_id: payload.user_id,
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
    };
    successResponse(res, {
      message: "Token refreshed successfully.",
      data: {
        access: generateAccessToken(claims),
        refresh: generateRefreshToken(claims),
      },
    });
  } catch {
    res.setHeader("WWW-Authenticate", 'Bearer realm="api"');
    errorResponse(res, {
      message: "Token refresh failed.",
      errors: {
        detail: "Token is invalid or expired",
        code: "token_not_valid",
      },
      statusCode: 401,
    });
  }
};

const changePassword: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const body = readBody(req);
  const errors: FieldErrors = {};

  const currentField = readRequiredChar(body["current_password"], { trim: false });
  const newField = readRequiredChar(body["new_password"], { trim: false });
  const confirmField = readRequiredChar(body["confirm_password"], { trim: false });

  if (currentField.errors.length > 0) {
    errors.current_password = currentField.errors;
  }
  if (newField.errors.length > 0) {
    errors.new_password = newField.errors;
  }
  if (confirmField.errors.length > 0) {
    errors.confirm_password = confirmField.errors;
  }

  const currentPassword = currentField.value ?? "";
  const newPassword = newField.value ?? "";
  const confirmPassword = confirmField.value ?? "";

  if (newField.value !== undefined) {
    const passwordErrors = validateNewPassword(newPassword);
    if (passwordErrors.length > 0) {
      errors.new_password = [...(errors.new_password ?? []), ...passwordErrors];
    }
  }

  if (Object.keys(errors).length > 0) {
    errorResponse(res, {
      message: "Password change failed.",
      errors,
      statusCode: 400,
    });
    return;
  }

  const dbUser = await User.findById(req.user?.id).exec();
  if (!dbUser || dbUser.is_deleted) {
    errorResponse(res, { message: "User not found.", statusCode: 404 });
    return;
  }

  const currentOk = await verifyDjangoPassword(currentPassword, dbUser.password);
  if (!currentOk) {
    errorResponse(res, {
      message: "Password change failed.",
      errors: { current_password: ["Current password is incorrect."] },
      statusCode: 400,
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    errorResponse(res, {
      message: "Password change failed.",
      errors: { confirm_password: ["Passwords do not match."] },
      statusCode: 400,
    });
    return;
  }

  if (currentPassword === newPassword) {
    errorResponse(res, {
      message: "Password change failed.",
      errors: {
        new_password: ["New password must be different from current password."],
      },
      statusCode: 400,
    });
    return;
  }

  dbUser.password = await hashDjangoPassword(newPassword);
  await dbUser.save();

  successResponse(res, { message: "Password changed successfully." });
};

const authRouter = Router();

authRouter.post("/login/", login);
authRouter.post("/login", login);
authRouter.post("/logout/", authenticate, logout);
authRouter.post("/logout", authenticate, logout);
authRouter.post("/token/refresh/", refresh);
authRouter.post("/token/refresh", refresh);
authRouter.get("/me/", authenticate, me);
authRouter.get("/me", authenticate, me);
authRouter.patch("/me/", authenticate, updateMe);
authRouter.patch("/me", authenticate, updateMe);
authRouter.post("/change-password/", authenticate, changePassword);
authRouter.post("/change-password", authenticate, changePassword);

export default authRouter;
