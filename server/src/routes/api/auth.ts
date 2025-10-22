// server/src/routes/api/auth.ts
import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { setupPassport } from "../../services/passport.js";
import { requireAuthOptional } from "../../middleware/auth.js";

const router = express.Router();

// Khởi tạo strategy (Google/Facebook)
setupPassport();

const WEB_ORIGIN = process.env.PUBLIC_WEB_ORIGIN || "https://mdrdr.xyz";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// Helper: set cookie JWT và redirect về FE
function setTokenAndRedirect(
  res: express.Response,
  user: { id: number; display_name: string; avatar_url?: string | null; email?: string | null }
) {
  const token = jwt.sign(
    {
      id: user.id,
      display_name: user.display_name ?? null,
      avatar_url: user.avatar_url ?? null,
      email: user.email ?? null,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  // cookie ở domain chính để FE đọc được; secure khi dùng https
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: /^https:\/\//i.test(WEB_ORIGIN),
    domain: ".mdrdr.xyz",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
    path: "/",
  });

  res.redirect(WEB_ORIGIN);
}

// ================= Google OAuth =================
// Mount ở đây dùng prefix /auth/... để khi gắn dưới app.use('/api', ...) => /api/auth/...
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false }) as any
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${WEB_ORIGIN}?login=failed`, session: false }) as any,
  (req: any, res) => {
    if (!req.user) return res.redirect(`${WEB_ORIGIN}?login=failed`);
    setTokenAndRedirect(res, req.user);
  }
);

// ================= Facebook OAuth ================
router.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["public_profile", "email"], session: false }) as any
);

router.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: `${WEB_ORIGIN}?login=failed`, session: false }) as any,
  (req: any, res) => {
    if (!req.user) return res.redirect(`${WEB_ORIGIN}?login=failed`);
    setTokenAndRedirect(res, req.user);
  }
);

// ================= Me / Logout ===================
// Trả trạng thái đăng nhập — hỗ trợ cả /api/auth/me và /api/me
const meHandler = [requireAuthOptional as any, (req: any, res: express.Response) => {
  res.json({ ok: true, user: req.user || null });
}];

router.get("/auth/me", ...meHandler);
router.get("/me", ...meHandler);

// Logout — hỗ trợ cả /api/auth/logout và /api/logout
function clearToken(res: express.Response) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: /^https:\/\//i.test(WEB_ORIGIN),
    domain: ".mdrdr.xyz",
    path: "/",
  });
}

router.post("/auth/logout", (_req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

export default router;
