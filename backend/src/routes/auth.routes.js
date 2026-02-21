import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { collections } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import {
    normalizeEmail,
    validateRegisterInput,
    validateLoginInput,
} from "../utils/validators.js";

const router = Router();
const SALT_ROUNDS = 10;

// ─── POST /api/auth/register ────────────────────────────────────────────────
// Register a new participant account.
router.post("/register", async (req, res, next) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            participantType,
            collegeOrOrg,
            contact,
        } = req.body;

        // Validate input
        const error = validateRegisterInput(req.body);
        if (error) return res.status(400).json({ error });

        const normalizedEmail = normalizeEmail(email);
        const now = new Date();

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert user
        let userResult;
        try {
            userResult = await collections.users.insertOne({
                email: normalizedEmail,
                passwordHash,
                role: "participant",
                isDisabled: false,
                createdAt: now,
                updatedAt: now,
            });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ error: "Email already registered" });
            }
            throw err;
        }

        // Insert participant profile
        await collections.participant_profiles.insertOne({
            userId: userResult.insertedId,
            firstName,
            lastName,
            contact: contact || "",
            participantType,
            collegeOrOrg: collegeOrOrg || "",
            areasOfInterest: [],
            followedOrganizers: [],
            createdAt: now,
            updatedAt: now,
        });

        res.status(201).json({ message: "Registration successful" });
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/auth/login ───────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const error = validateLoginInput(req.body);
        if (error) return res.status(400).json({ error });

        const normalizedEmail = normalizeEmail(email);
        const user = await collections.users.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Block disabled accounts from getting a new token
        if (user.isDisabled) {
            return res
                .status(403)
                .json({ error: "Account is disabled. Contact an administrator." });
        }

        const token = jwt.sign(
            { userId: user._id.toString(), role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({ token, role: user.role });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────
// Return current user info (requires valid JWT).
router.get("/me", authRequired, async (req, res, next) => {
    try {
        const user = await collections.users.findOne(
            { _id: new (await import("mongodb")).ObjectId(req.user.userId) },
            { projection: { passwordHash: 0 } }
        );

        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({ userId: user._id, email: user.email, role: user.role });
    } catch (err) {
        next(err);
    }
});

export default router;
