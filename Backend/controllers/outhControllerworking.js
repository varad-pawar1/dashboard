import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { Google } from "arctic";
import * as jwtDecodePkg from "jwt-decode";
import dotenv from "dotenv";
dotenv.config();

// jwt-decode can export either as a default or as the module itself depending on bundler/packaging.
const jwtDecode = jwtDecodePkg.default || jwtDecodePkg;

// Robust decoder wrapper: some environments/bundlers expose jwt-decode differently.
// This helper tries known shapes and falls back to manual base64 payload parsing.
const decodeJwt = (token) => {
  if (!token) throw new Error("No token provided to decode");
  // Primary: jwtDecode function
  if (typeof jwtDecode === "function") return jwtDecode(token);
  // Sometimes namespace import holds default under .default
  if (jwtDecode && typeof jwtDecode.default === "function")
    return jwtDecode.default(token);

  // Fallback: try to parse the JWT payload manually (unsafe but useful for debugging)
  try {
    const parts = token.split(".");
    if (parts.length < 2) throw new Error("Invalid JWT format");
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (err) {
    throw new Error("jwtDecode is not a function");
  }
};

// ==================== GOOGLE PROVIDER ====================
// Make sure env variables exist
if (
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_CLIENT_SECRET ||
  !process.env.BACKEND_URL
) {
  throw new Error("Missing Google OAuth environment variables");
}

// Also ensure frontend URL and JWT secret exist
if (!process.env.FRONTEND_URL || !process.env.JWT_SECRET) {
  throw new Error("Missing FRONTEND_URL or JWT_SECRET environment variables");
}

const google = new Google(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/auth/google/callback`
);

// (Using confidential server-side flow; no PKCE store required)

// ==================== REGISTER ====================
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== LOGIN ====================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // Use 'lax' so the cookie will be set on top-level GET navigations (the Google redirect)
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== GET CURRENT USER ====================
export const getMe = async (req, res) => {
  try {
    // req.user is set by protect middleware (contains id, email, name)
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==================== GOOGLE AUTH ====================
export const googleAuth = async (req, res) => {
  try {
    // Use confidential server-side OAuth flow (no PKCE)
    const state = Math.random().toString(36).substring(2, 15);
    // Build non-PKCE authorization URL using arctic's underlying client
    const authorizationEndpoint =
      "https://accounts.google.com/o/oauth2/v2/auth";
    const url = google.client.createAuthorizationURL(
      authorizationEndpoint,
      state,
      ["openid", "profile", "email"]
    );

    // Store state in a cookie so we can validate on callback
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });

    console.log("Google redirect URL:", url.toString());
    res.redirect(url.toString());
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};

// ==================== GOOGLE CALLBACK ====================
export const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code)
      return res.status(400).json({ message: "Authorization code missing" });

    const returnedState = req.query.state;
    const expectedState = req.cookies?.oauth_state || null;
    if (expectedState && returnedState !== expectedState) {
      return res.status(400).json({ message: "Invalid OAuth state" });
    }

    // Diagnostic logs
    try {
      console.log("[Google Callback] query:", req.query);
      console.log(
        `[Google Callback] oauth_state_present=${!!req.cookies
          ?.oauth_state}, returnedState=${returnedState}, expectedState=${expectedState}`
      );
      console.log(
        `[Google Callback] configured redirect URI = ${process.env.BACKEND_URL}/auth/google/callback`
      );

      // Exchange code for tokens (confidential client, no PKCE)
      // Do the token request manually so we can capture Google's full error response
      const tokenEndpoint = "https://oauth2.googleapis.com/token";
      const params = new URLSearchParams();
      params.set("code", code);
      params.set("client_id", process.env.GOOGLE_CLIENT_ID);
      params.set("client_secret", process.env.GOOGLE_CLIENT_SECRET);
      params.set(
        "redirect_uri",
        `${process.env.BACKEND_URL}/auth/google/callback`
      );
      params.set("grant_type", "authorization_code");

      let tokenResponse;
      try {
        const r = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        const json = await r.json().catch(() => null);
        tokenResponse = { status: r.status, body: json };
      } catch (err) {
        console.error("[Google Callback] token fetch failed:", err);
        throw err;
      }

      if (tokenResponse.status === 200 && tokenResponse.body) {
        var tokens = tokenResponse.body; // access_token, id_token, etc.
        console.log(
          "[Google Callback] token exchange successful, token keys:",
          Object.keys(tokens)
        );
      } else {
        console.error(
          "[Google Callback] token endpoint returned error:",
          tokenResponse.body
        );
        const err = new Error("Token endpoint error");
        err.details = tokenResponse.body;
        throw err;
      }
    } catch (err) {
      console.error("[Google Callback] token exchange failed", {
        message: err.message,
        stack: err.stack,
        code,
        redirectURI: `${process.env.BACKEND_URL}/auth/google/callback`,
      });
      throw err; // will be caught by outer try/catch and return Google login failed
    }

    // Helper: fetch userinfo from Google using access token when id_token is missing
    const fetchGoogleUserinfo = async (accessToken) => {
      if (!accessToken)
        throw new Error("No access token available to fetch userinfo");
      // Prefer global fetch if available (Node 18+), otherwise use https
      if (typeof fetch === "function") {
        const r = await fetch(
          "https://openidconnect.googleapis.com/v1/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!r.ok) throw new Error(`Failed to fetch userinfo: ${r.status}`);
        return r.json();
      }

      const https = await import("https");
      return new Promise((resolve, reject) => {
        const options = {
          hostname: "openidconnect.googleapis.com",
          path: "/v1/userinfo",
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        };
        const req = https.request(options, (resp) => {
          let data = "";
          resp.on("data", (chunk) => (data += chunk));
          resp.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (resp.statusCode >= 400)
                return reject(
                  new Error(
                    `Failed to fetch userinfo: ${resp.statusCode} ${data}`
                  )
                );
              resolve(json);
            } catch (err) {
              reject(err);
            }
          });
        });
        req.on("error", reject);
        req.end();
      });
    };

    // Decode the ID token if present, otherwise use the access token to get userinfo
    let decoded;
    try {
      // Google returns snake_case keys (id_token, access_token). Some libs map to camelCase.
      if (tokens.id_token || tokens.idToken) {
        decoded = decodeJwt(tokens.id_token || tokens.idToken);
      } else if (tokens.access_token || tokens.accessToken) {
        const accessToken = tokens.access_token || tokens.accessToken;
        decoded = await fetchGoogleUserinfo(accessToken);
      } else {
        console.error(
          "[Google Callback] token response had no id_token or access_token:",
          tokens
        );
        throw new Error("No id_token or access_token returned from Google");
      }
    } catch (err) {
      console.error("Failed to obtain user info from Google:", err);
      return res.status(500).json({
        message: "Failed to obtain user info from Google",
        error: err.message,
      });
    }

    const { name, email, picture } = decoded || {};

    if (!email)
      return res.status(400).json({ message: "No email received from Google" });

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      const userData = {
        name: name || "Google User",
        email,
        avatar: picture || "",
      };
      user = new User(userData);
      await user.save();
    }

    // Create JWT for app
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Redirect to frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("Google login error:", error);
    const payload = { message: "Google login failed", stack: error.stack };
    if (error && error.details) payload.details = error.details;
    res.status(500).json(payload);
  }
};
