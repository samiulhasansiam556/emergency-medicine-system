import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { UserRole } from "../models/User";

const SALT_ROUNDS = 12;

function getJwtConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing from environment variables");
  return {
    secret,
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  };
}

export function signToken(userId: string, role: UserRole): string {
  const { secret, expiresIn } = getJwtConfig();
  return jwt.sign({ role }, secret, { subject: userId, expiresIn });
}

export function verifyToken(token: string): { id: string; role: UserRole } {
  const { secret } = getJwtConfig();
  const payload = jwt.verify(token, secret) as jwt.JwtPayload;
  return { id: payload.sub as string, role: payload.role as UserRole };
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();

  // Public signup can never create ADMIN accounts.
  const role: UserRole =
    input.role === "PHARMACY_OWNER" ? "PHARMACY_OWNER" : "USER";

  const existing = await User.findOne({ email });
  if (existing) throw new Error("Email is already registered.");

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role,
  });

  return {
    token: signToken(user._id.toString(), user.role),
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  };
}

export async function loginUser(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();

  // passwordHash has select:false, so request it explicitly.
  const user = await User.findOne({ email }).select("+passwordHash");

  // Same message for unknown email and wrong password.
  const invalid = new Error("Invalid email or password.");
  if (!user || !user.isActive) throw invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid;

  return {
    token: signToken(user._id.toString(), user.role),
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  };
}

export async function getUserById(id: string) {
  const user = await User.findOne({ _id: id, isActive: true }).select("-__v");
  if (!user) throw new Error("User not found.");
  return user;
}