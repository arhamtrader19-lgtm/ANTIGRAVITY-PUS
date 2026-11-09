import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import ApiError from "./utils/ApiError.js";

const app = express();

app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

app.use(cookieParser());

import healthcheckRouter from "./routes/healthcheck.routes.js";
import userRouter from "./routes/user.routes.js";

app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);

app.use((req, res, next) => {
    next(
        new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`)
    );
});

app.use((err, req, res, next) => {
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {}).join(", ");
        err = new ApiError(409, `Duplicate value for: ${field}`, [], err.stack);
    }

    if (err.name === "ValidationError" && !(err instanceof ApiError)) {
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
        err = new ApiError(400, "Validation failed", errors, err.stack);
    }

    if (err.name === "CastError") {
        err = new ApiError(
            400,
            `Invalid ${err.path}: ${err.value}`,
            [],
            err.stack
        );
    }

    if (err.type === "entity.too.large") {
        err = new ApiError(
            413,
            "Request body is too large (limit: 16kb)",
            [],
            err.stack
        );
    }
    if (err.type === "entity.parse.failed") {
        err = new ApiError(
            400,
            "Malformed JSON in request body",
            [],
            err.stack
        );
    }

    if (err.name === "TokenExpiredError") {
        err = new ApiError(401, "Access token has expired", [], err.stack);
    }
    if (err.name === "JsonWebTokenError") {
        err = new ApiError(401, "Invalid access token", [], err.stack);
    }

    const statusCode = err.statusCode || err.status || 500;

    return res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
        data: null,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});

export { app };
