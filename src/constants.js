export const DB_NAME = process.env.DB_NAME || "hasnain";

export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
};
