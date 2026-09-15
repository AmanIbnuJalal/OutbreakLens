import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  RegisterSourceBody,
  RegisterSourceResponse,
} from "@workspace/api-zod";
import {
  createToken,
  hashPassword,
  requireAuth,
  toUserResponse,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: parsed.data.email.toLowerCase(),
      hashedPassword: hashPassword(parsed.data.password),
      role: "source",
      sourceName: parsed.data.sourceName,
      sourceType: parsed.data.sourceType,
      locationName: parsed.data.locationName,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    })
    .returning();

  const response = { token: createToken(user.id), user: toUserResponse(user) };
  res.status(201).json(RegisterSourceResponse.parse(response));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));
  if (!user || !verifyPassword(parsed.data.password, user.hashedPassword)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const response = { token: createToken(user.id), user: toUserResponse(user) };
  res.json(LoginResponse.parse(response));
});

router.get(
  "/auth/me",
  requireAuth,
  async (req: Request, res): Promise<void> => {
    const user = (req as Request & { user: typeof usersTable.$inferSelect }).user;
    res.json(GetCurrentUserResponse.parse(toUserResponse(user)));
  },
);

export default router;