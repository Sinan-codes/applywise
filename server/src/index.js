import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import Profile from "./models/Profile.js";
import { generateAnswers } from "./services/ai.js";

const app = express();
const port = Number(process.env.PORT || 3001);

if (!process.env.APPLYWISE_API_TOKEN) {
  throw new Error("APPLYWISE_API_TOKEN is required. Set it in server/.env before starting the server.");
}

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean)
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || origin.startsWith("chrome-extension://")) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.use("/api", (request, response, next) => {
  const authorization = request.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const suppliedToken = Buffer.from(token);
  const expectedToken = Buffer.from(process.env.APPLYWISE_API_TOKEN);
  if (suppliedToken.length !== expectedToken.length
    || suppliedToken.length === 0
    || !timingSafeEqual(suppliedToken, expectedToken)) {
    response.status(401).json({ error: "A valid API access token is required. Set it in your extension profile." });
    return;
  }
  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.get("/api/profile", async (_request, response, next) => {
  try {
    const profile = await Profile.findOne().lean();
    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

app.put("/api/profile", async (request, response, next) => {
  try {
    const allowedFields = [
      "fullName", "email", "phone", "location", "linkedin", "website", "github",
      "skills", "education", "workAuthorization",
      "sponsorship", "salaryExpectation"
    ];
    const updates = Object.fromEntries(
      allowedFields
        .filter((field) => typeof request.body?.[field] === "string")
        .map((field) => [field, request.body[field]])
    );

    if (!updates.fullName?.trim() || !updates.email?.trim()) {
      response.status(400).json({ error: "Full name and email are required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email.trim())) {
      response.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const profile = await Profile.findOneAndUpdate({}, updates, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }).lean();
    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

app.post("/api/answers", async (request, response, next) => {
  try {
    const { profile, fields } = request.body || {};
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      response.status(400).json({ error: "A candidate profile is required." });
      return;
    }
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 80) {
      response.status(400).json({ error: "Provide between 1 and 80 application fields." });
      return;
    }
    const validFields = fields.every((field) =>
      field && typeof field.id === "string" && field.id.length <= 100
      && typeof field.label === "string" && field.label.length <= 200
    );
    if (!validFields) {
      response.status(400).json({ error: "Application fields must include valid ids and labels." });
      return;
    }

    const answers = await generateAnswers({ profile, fields });
    response.json({ answers });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({ error: "Please check your profile details and try again." });
    return;
  }
  if (error.type === "entity.parse.failed" || error.status === 413) {
    response.status(error.status || 400).json({ error: "The request body is invalid or too large." });
    return;
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error("API error:", error);
  response.status(status).json({
    error: status >= 500 ? "The server could not complete this request." : error.message
  });
});

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/applywise");
app.listen(port, () => console.log(`Applywise API listening on http://localhost:${port}`));
