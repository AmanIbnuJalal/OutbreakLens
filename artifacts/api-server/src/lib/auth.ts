import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set for authentication.");
  }
  return secret;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function createToken(userId: number): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }),
  );
  const signature = base64Url(
    createHmac("sha256", getSecret()).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): number | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const expected = base64Url(
    createHmac("sha256", getSecret()).update(`${header}.${payload}`).digest(),
  );
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: number;
      exp?: number;
    };
    if (
      typeof decoded.sub !== "number" ||
      typeof decoded.exp !== "number" ||
      decoded.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return decoded.sub;
  } catch {
    return null;
  }
}

async function resolveUser(req: Request): Promise<User | null> {
  const value = req.header("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const id = verifyToken(value.slice("Bearer ".length));
  if (!id) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user ?? null;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void resolveUser(req)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      (req as Request & { user: User }).user = user;
      next();
    })
    .catch(next);
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, () => {
    const user = (req as Request & { user: User }).user;
    if (user.role !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    next();
  });
}

export function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sourceName: user.sourceName,
    sourceType: user.sourceType,
    locationName: user.locationName,
    lat: user.lat,
    lng: user.lng,
    createdAt: user.createdAt,
  };
}