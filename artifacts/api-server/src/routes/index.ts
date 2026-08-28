import { Router, type IRouter } from "express";
import healthRouter from "./health";
import protradersRouter, { handleOAuthCallback } from "./protraders";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(protradersRouter);
router.use(workspaceRouter);

export default router;
