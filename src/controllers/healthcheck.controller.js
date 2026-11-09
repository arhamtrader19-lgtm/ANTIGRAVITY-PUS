import mongoose from "mongoose";
import { ApiResponse } from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
    const readyState = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                uptime: `${Math.floor(process.uptime())}s`,
                database: states[readyState] ?? "unknown",
                timestamp: new Date().toISOString(),
            },
            "API is healthy"
        )
    );
});

const forceError = asyncHandler(async (req, res) => {
    throw new ApiError(418, "This is a deliberate test error", [
        { field: "demo", message: "ApiError was caught by the global handler" },
    ]);
});

export { healthcheck, forceError };
