import { UAParser } from "ua-parser-js";

export interface DeviceInfo {
  device: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  isMobile: boolean;
  isDesktop: boolean;
  isTablet: boolean;
}

export function parseUserAgent(userAgent: string): DeviceInfo {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const deviceType = result.device.type || "desktop";
  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";
  const isDesktop = !isMobile && !isTablet;

  return {
    device:
      deviceType === "mobile"
        ? "Mobile"
        : deviceType === "tablet"
        ? "Tablet"
        : "Desktop",
    os: result.os.name || "Unknown",
    osVersion: result.os.version || "",
    browser: result.browser.name || "Unknown",
    browserVersion: result.browser.version || "",
    isMobile,
    isDesktop,
    isTablet,
  };
}
