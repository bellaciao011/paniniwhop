import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stripeRouter from "./stripe";
import whopRouter from "./whop";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stripeRouter);
router.use(whopRouter);

export default router;
