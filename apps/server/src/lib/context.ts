import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { prisma } from "./prisma";

export async function createContext(opts: CreateExpressContextOptions) {
  return {
    session: null,
    prisma,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
