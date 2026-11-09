import "dotenv/config";

import mongoose from "mongoose";
import { app } from "./app.js";
import connectDB from "./db/index.js";

const PORT = process.env.PORT || 8000;

let server;

connectDB()
    .then(() => {
        server = app.listen(PORT, () => {
            console.log(`\nServer is running at http://localhost:${PORT}`);
            console.log(
                `Healthcheck: http://localhost:${PORT}/api/v1/healthcheck`
            );
            console.log(
                `Environment: ${process.env.NODE_ENV || "development"}\n`
            );
        });
        server.on("error", (error) => {
            if (error.code === "EADDRINUSE") {
                console.error(
                    `Port ${PORT} is already in use. Stop the other process or change PORT in .env`
                );
            } else {
                console.error("HTTP server error:", error);
            }
            process.exit(1);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection FAILED. Server was not started.");
        console.error(error);
        process.exit(1);
    });

const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
    console.log("Closed HTTP server and MongoDB connection.");
    process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION:", reason);
    shutdown("unhandledRejection");
});
