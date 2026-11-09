import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const maskUri = (uri = "") => uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");

const connectDB = async () => {
    try {
        const baseUri = process.env.MONGODB_URI;

        if (!baseUri) {
            throw new Error(
                "MONGODB_URI is missing. Copy .env.example to .env and set MONGODB_URI."
            );
        }

        const connectionString = `${baseUri}/${DB_NAME}`;

        mongoose.set("debug", process.env.MONGOOSE_DEBUG === "true");

        console.log(`Connecting to MongoDB: ${maskUri(connectionString)}`);

        const connectionInstance = await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log(
            `MongoDB connected. HOST: ${connectionInstance.connection.host} | DB: ${connectionInstance.connection.name}`
        );

        mongoose.connection.on("error", (err) => {
            console.error("MongoDB runtime error:", err.message);
        });

        mongoose.connection.on("disconnected", () => {
            console.warn(
                "MongoDB disconnected. Mongoose will retry automatically."
            );
        });

        mongoose.connection.on("reconnected", () => {
            console.log("MongoDB reconnected.");
        });

        return connectionInstance;
    } catch (error) {
        console.error("\nMONGODB connection FAILED:", error.message);

        const hints = {
            ECONNREFUSED:
                "Nothing is listening on that address. Start MongoDB: `npm run db:up` (Docker) or start your local MongoDB service.",
            ENOTFOUND:
                "DNS lookup failed. Check the cluster hostname in MONGODB_URI, and check your internet connection.",
            ETIMEOUT:
                "Timed out. On Atlas, add your IP under Network Access (or 0.0.0.0/0 for testing).",
            "bad auth":
                "Wrong username/password. Check the credentials in MONGODB_URI and URL-encode special characters (@ -> %40, # -> %23).",
            "Authentication failed":
                "Wrong username/password, or the user was created against the wrong auth database.",
        };

        const match = Object.keys(hints).find((key) =>
            `${error.code || ""} ${error.message}`.includes(key)
        );
        if (match) {
            console.error(`HINT: ${hints[match]}`);
        }

        throw error;
    }
};

export default connectDB;
