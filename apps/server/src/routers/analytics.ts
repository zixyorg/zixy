import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";
import { prisma } from "../lib/prisma";
import { TRPCError } from "@trpc/server";
import { parseUserAgent } from "../lib/utils/userAgent";
import { parseLocation } from "../lib/utils/location";
import { detectBot } from "../lib/utils/botDetection";

// Input schemas
const recordAnalyticsSchema = z.object({
  shortCode: z.string(),
  ip: z.string(),
  userAgent: z.string(),
  referer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
});

const getAnalyticsSchema = z.object({
  linkId: z.string(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
});

const getAnalyticsOverviewSchema = z.object({
  linkId: z.string(),
  period: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("30d"),
});

export const analyticsRouter = router({
  // Record a new analytics event (click/view)
  record: publicProcedure
    .input(recordAnalyticsSchema)
    .mutation(async ({ input }) => {
      try {
        // Find the link
        const link = await prisma.link.findUnique({
          where: { shortCode: input.shortCode },
        });

        if (!link || !link.isActive) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link not found or inactive",
          });
        }

        // Check if link is expired
        if (link.expiresAt && link.expiresAt < new Date()) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Link has expired",
          });
        }

        // Parse user agent for device info
        const deviceInfo = parseUserAgent(input.userAgent);

        // Parse IP for location (you'll need to implement this)
        const locationInfo = await parseLocation(input.ip);

        // Check if it's a bot
        const isBot = detectBot(input.userAgent);

        // Record the analytics event
        const analytics = await prisma.analytics.create({
          data: {
            linkId: link.id,
            eventType: "CLICK",
            ip: input.ip,
            userAgent: input.userAgent,
            referer: input.referer,

            // Location data
            country: locationInfo.country,
            region: locationInfo.region,
            city: locationInfo.city,
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            timezone: locationInfo.timezone,

            // Device data
            device: deviceInfo.device,
            os: deviceInfo.os,
            osVersion: deviceInfo.osVersion,
            browser: deviceInfo.browser,
            browserVersion: deviceInfo.browserVersion,

            // Device flags
            isBot,
            isMobile: deviceInfo.isMobile,
            isDesktop: deviceInfo.isDesktop,
            isTablet: deviceInfo.isTablet,

            // UTM parameters
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
            utmTerm: input.utmTerm,
            utmContent: input.utmContent,
          },
        });

        return {
          success: true,
          redirectUrl: link.originalUrl,
          analyticsId: analytics.id,
        };
      } catch (error) {
        console.error("Analytics recording error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record analytics",
        });
      }
    }),

  // Get analytics overview for a link
  getOverview: publicProcedure
    .input(getAnalyticsOverviewSchema)
    .query(async ({ input }) => {
      const { linkId, period } = input;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date | undefined;

      switch (period) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case "all":
          startDate = undefined;
          break;
      }

      const whereClause = {
        linkId,
        ...(startDate && { timestamp: { gte: startDate } }),
        isBot: false, // Exclude bot traffic
      };

      // Get total clicks
      const totalClicks = await prisma.analytics.count({
        where: whereClause,
      });

      // Get unique clicks (unique IPs)
      const uniqueClicks = await prisma.analytics.groupBy({
        by: ["ip"],
        where: whereClause,
        _count: true,
      });

      // Get top countries
      const topCountries = await prisma.analytics.groupBy({
        by: ["country"],
        where: { ...whereClause, country: { not: null } },
        _count: true,
        orderBy: { _count: { country: "desc" } },
        take: 10,
      });

      // Get top devices
      const topDevices = await prisma.analytics.groupBy({
        by: ["device"],
        where: { ...whereClause, device: { not: null } },
        _count: true,
        orderBy: { _count: { device: "desc" } },
      });

      // Get top browsers
      const topBrowsers = await prisma.analytics.groupBy({
        by: ["browser"],
        where: { ...whereClause, browser: { not: null } },
        _count: true,
        orderBy: { _count: { browser: "desc" } },
        take: 10,
      });

      // Get top referrers
      const topReferrers = await prisma.analytics.groupBy({
        by: ["referer"],
        where: { ...whereClause, referer: { not: null } },
        _count: true,
        orderBy: { _count: { referer: "desc" } },
        take: 10,
      });

      return {
        totalClicks,
        uniqueClicks: uniqueClicks.length,
        topCountries: topCountries.map((c: any) => ({
          country: c.country,
          clicks: c._count.country,
        })),
        topDevices: topDevices.map((d: any) => ({
          device: d.device,
          clicks: d._count.device,
        })),
        topBrowsers: topBrowsers.map((b: any) => ({
          browser: b.browser,
          clicks: b._count.browser,
        })),
        topReferrers: topReferrers.map((r: any) => ({
          referer: r.referer,
          clicks: r._count.referer,
        })),
      };
    }),

  // Get time-series analytics data
  getTimeSeries: publicProcedure
    .input(getAnalyticsSchema)
    .query(async ({ input }) => {
      const { linkId, startDate, endDate, groupBy } = input;

      const whereClause = {
        linkId,
        isBot: false,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      };

      // Group by time period
      let timeFormat: string;
      switch (groupBy) {
        case "day":
          timeFormat = "%Y-%m-%d";
          break;
        case "week":
          timeFormat = "%Y-%u";
          break;
        case "month":
          timeFormat = "%Y-%m";
          break;
      }

      // Use raw SQL for time-based grouping (PostgreSQL specific)
      const timeSeriesData = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC(${groupBy}, timestamp) as period,
          COUNT(*) as clicks,
          COUNT(DISTINCT ip) as unique_clicks
        FROM analytics 
        WHERE link_id = ${linkId} 
          AND is_bot = false
          ${startDate ? `AND timestamp >= ${startDate}` : ""}
          ${endDate ? `AND timestamp <= ${endDate}` : ""}
        GROUP BY DATE_TRUNC(${groupBy}, timestamp)
        ORDER BY period ASC
      `;

      return timeSeriesData;
    }),

  // Get detailed analytics breakdown
  getBreakdown: publicProcedure
    .input(
      z.object({
        linkId: z.string(),
        breakdownType: z.enum([
          "country",
          "device",
          "browser",
          "os",
          "referer",
        ]),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const { linkId, breakdownType, startDate, endDate } = input;

      const whereClause = {
        linkId,
        isBot: false,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
        [breakdownType]: { not: null },
      };

      const breakdown = await prisma.analytics.groupBy({
        by: [breakdownType as any],
        where: whereClause,
        _count: true,
        orderBy: { _count: { [breakdownType]: "desc" } },
        take: 50,
      });

      return breakdown.map((item: any) => ({
        [breakdownType]: item[breakdownType as keyof typeof item],
        clicks: item._count[breakdownType as keyof typeof item._count],
      }));
    }),
});
