import { Router } from "express";
import {
    healthcheck,
    forceError,
} from "../controllers/healthcheck.controller.js";

const router = Router();

router.route("/").get(healthcheck);
router.route("/error").get(forceError);

export default router;
