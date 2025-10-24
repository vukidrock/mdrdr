// server/src/services/passport.ts
import passport from "passport";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from "passport-facebook";
import { q } from "../utils/db.js";

const API_BASE = process.env.PUBLIC_API_BASE || "";

type DBUser = { id:number; display_name:string; avatar_url?:string|null };

async function upsertUser(opts:{
  provider: "google" | "facebook";
  providerId: string;
  displayName: string;
  avatar?: string;
  email?: string;
}): Promise<DBUser> {
  const identity = (await q<any>(
    `SELECT ui.*, u.display_name, u.avatar_url
       FROM user_identities ui
       JOIN users u ON u.id = ui.user_id
      WHERE ui.provider=$1 AND ui.provider_user_id=$2
      LIMIT 1`,
    [opts.provider, opts.providerId]
  ))[0];

  if (identity) {
    return { id: identity.user_id, display_name: identity.display_name, avatar_url: identity.avatar_url };
  }

  const user = (await q<DBUser>(
    `INSERT INTO users(display_name, avatar_url)
     VALUES($1,$2)
     RETURNING id, display_name, avatar_url`,
    [opts.displayName, opts.avatar || null]
  ))[0];

  await q(
    `INSERT INTO user_identities(user_id, provider, provider_user_id, email)
     VALUES($1,$2,$3,$4)`,
    [user.id, opts.provider, opts.providerId, opts.email || null]
  );

  return user;
}

export function setupPassport() {
  const googleCb = `${API_BASE}/api/auth/google/callback`;
  passport.use(new GoogleStrategy({
    clientID:     process.env.OAUTH_GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || "",
    callbackURL:  googleCb
  }, async (_accessToken: string, _refreshToken: string, profile: GoogleProfile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const avatar = profile.photos?.[0]?.value;
      const user = await upsertUser({
        provider:"google",
        providerId: profile.id,
        displayName: profile.displayName || email || "User",
        avatar, email
      });
      done(null, user);
    } catch (e) { done(e as any); }
  }));

  const fbCb = `${API_BASE}/api/auth/facebook/callback`;
  passport.use(new FacebookStrategy({
    clientID: process.env.OAUTH_FACEBOOK_APP_ID || "",
    clientSecret: process.env.OAUTH_FACEBOOK_APP_SECRET || "",
    callbackURL: fbCb,
    profileFields: ["id", "displayName", "photos", "emails"]
  }, async (_accessToken: string, _refreshToken: string, profile: FacebookProfile, done) => {
    try {
      const email = (profile.emails && profile.emails[0]?.value) || undefined;
      const avatar = (profile.photos && profile.photos[0]?.value) || undefined;
      const user = await upsertUser({
        provider:"facebook",
        providerId: profile.id,
        displayName: profile.displayName || email || "User",
        avatar, email
      });
      done(null, user);
    } catch (e) { done(e as any); }
  }));

  return passport;
}
