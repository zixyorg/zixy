import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";
import { prisma } from "../lib/prisma";
import { TRPCError } from "@trpc/server";
import { generateShortCode } from "../lib/utils/shortCode";

const createLinkSchema = z.object({
  originalUrl: z.string().url(),
  customCode: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  password: z.string().optional(),
  expiresAt: z.date().optional(),
});

const getLinkSchema = z.object({
  shortCode: z.string(),
});

export const linksRouter = router({
  create: publicProcedure
    .input(createLinkSchema)
    .mutation(async ({ input }) => {
      const shortCode = input.customCode || generateShortCode();

      // Check if custom code already exists
      if (input.customCode) {
        const existing = await prisma.link.findUnique({
          where: { shortCode: input.customCode },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Custom short code already exists",
          });
        }
      }

      const link = await prisma.link.create({
        data: {
          shortCode,
          originalUrl: input.originalUrl,
          title: input.title,
          description: input.description,
          password: input.password,
          expiresAt: input.expiresAt,
        },
      });

      return link;
    }),

  get: publicProcedure.input(getLinkSchema).query(async ({ input }) => {
    const link = await prisma.link.findUnique({
      where: { shortCode: input.shortCode },
      include: {
        _count: {
          select: { analytics: true },
        },
      },
    });

    if (!link) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Link not found",
      });
    }

    return link;
  }),

  list: publicProcedure.query(async () => {
    const links = await prisma.link.findMany({
      include: {
        _count: {
          select: { analytics: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return links;
  }),
});
