import jwt from "jsonwebtoken";
import User from "../models/User.js";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";

import dotenv from "dotenv";
dotenv.config();

// ==================== REGISTER ====================
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Add "email" provider if not already added
      if (!existingUser.providers.includes("email")) {
        existingUser.providers.push("email");
        existingUser.password = password; // update password
        await existingUser.save();
      }
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = new User({
      name,
      email,
      password,
      providers: ["email"],
    });
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

    // Check if user signed up via email/password
    if (user.providers.includes("email")) {
      const isValid = await user.comparePassword(password);
      if (!isValid)
        return res.status(400).json({ message: "Invalid credentials" });
    } else {
      // User signed up via Google/GitHub, not email
      return res.status(400).json({
        message: `This email is registered via ${user.providers.join(
          " / "
        )}. Please login using the respective provider.`,
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logOut = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ==================== GOOGLE STRATEGY ====================
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email,
            avatar: profile.photos[0]?.value || "",
            googleId: profile.id,
            providers: ["google"],
          });
        } else {
          // Existing user → add Google if not already added
          if (!user.providers.includes("google")) {
            user.providers.push("google");
            user.googleId = profile.id;
            await user.save();
          }
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// ==================== GOOGLE LOGIN HANDLERS ====================
export const googleAuth = (req, res, next) => {
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
};

export const googleAuthCallback = (req, res, next) => {
  passport.authenticate("google", { failureRedirect: "/" })(req, res, () => {
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, name: req.user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  });
};

// ===== Passport GitHub Strategy =====
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`,
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName || profile.username,
            email,
            avatar: profile.photos[0]?.value || "",
            githubId: profile.id,
            providers: ["github"],
          });
        } else {
          // Existing user → add GitHub if not already added
          if (!user.providers.includes("github")) {
            user.providers.push("github");
            user.githubId = profile.id;
            await user.save();
          }
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// ===== Routes Handlers =====
export const githubAuth = (req, res, next) => {
  passport.authenticate("github")(req, res, next);
};

export const githubAuthCallback = (req, res, next) => {
  passport.authenticate("github", { failureRedirect: "/" })(req, res, () => {
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, name: req.user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  });
};
