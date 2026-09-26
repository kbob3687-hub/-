import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// QR visitors use the LAN hostname rather than the dev server's 0.0.0.0.
// Allow only addresses assigned to this computer, not arbitrary origins.
const localAddresses = Object.values(networkInterfaces()).flatMap((addresses) =>
  (addresses || []).filter((address) => !address.internal).map((address) => address.address)
);
const configuredUrl = process.env.NEXT_PUBLIC_PUBLIC_URL?.trim();
let configuredHostname: string[] = [];
if (configuredUrl) {
  try {
    const url = new URL(configuredUrl);
    if (url.protocol === "http:" || url.protocol === "https:") configuredHostname = [url.hostname];
  } catch { /* Invalid share URLs are explained in the invite dialog. */ }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [...new Set(["127.0.0.1", "[::1]", ...localAddresses, ...configuredHostname])],
};

export default nextConfig;
