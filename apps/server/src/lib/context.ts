import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export async function createContext(opts: CreateExpressContextOptions) {
  // No auth configured
	return {
		session: null,
	};
}


export type Context = Awaited<ReturnType<typeof createContext>>;
