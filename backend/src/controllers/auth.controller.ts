import { Request, Response } from "express";
import { registerUser, loginUser, getUserById, updateProfile, changePassword } from "../services/auth.service";
import { sendError } from "../utils/respond";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerController(req: Request, res: Response) {
  try {
    const { name, email, password, role } = req.body;

    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ success: false, message: "Name must be at least 2 characters." });
      return;
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ success: false, message: "A valid email is required." });
      return;
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
      res.status(400).json({ success: false, message: "Password must be 8 to 72 characters." });
      return;
    }

    const result = await registerUser({ name, email, password, role });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Email is already registered.") {
      res.status(409).json({ success: false, message });
      return;
    }
    console.error("Register failed:", error);
    res.status(500).json({ success: false, message: "Unable to register." });
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ success: false, message: "Email and password are required." });
      return;
    }

    const result = await loginUser(email, password);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid email or password.") {
      res.status(401).json({ success: false, message: error.message });
      return;
    }
    console.error("Login failed:", error);
    res.status(500).json({ success: false, message: "Unable to log in." });
  }
}

export async function meController(req: Request, res: Response) {
  try {
    const user = await getUserById(req.user!.id);
    res.status(200).json({ success: true, data: user });
  } catch {
    res.status(404).json({ success: false, message: "User not found." });
  }
}

export async function updateProfileController(req: Request, res: Response) {
  try {
    const data = await updateProfile(req.user!.id, { name: req.body?.name });
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Update profile");
  }
}

export async function changePasswordController(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      res.status(400).json({ success: false, message: "currentPassword and newPassword are required." });
      return;
    }
    await changePassword(req.user!.id, currentPassword, newPassword);
    res.status(200).json({ success: true, message: "Password changed." });
  } catch (error) {
    sendError(res, error, "Change password");
  }
}