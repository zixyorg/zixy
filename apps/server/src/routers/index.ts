import { publicProcedure, router } from "../lib/trpc";
import { analyticsRouter } from "./analytics";
import { linksRouter } from "../routers/links";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  analytics: analyticsRouter,
  links: linksRouter,
});
export type AppRouter = typeof appRouter;
