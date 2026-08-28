import { Router, type IRouter } from "express";
import healthRouter from "./health";
import protradersRouter, { handleOAuthCallback } from "./protraders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(protradersRouter);

export default router;
