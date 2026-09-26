import { networkInterfaces } from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export function GET() {
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !/vmware|vbox|virtual|vpn|tailscale|hyper-v|docker|vethernet|loopback/i.test(name))
    .flatMap(([name, addresses]) => (addresses || [])
      .filter((item) => item.family === "IPv4" && !item.internal && isPrivateIPv4(item.address))
      .map((item) => ({
        address: item.address,
        priority: /wlan|wi-?fi|wireless|ethernet|以太网|无线/i.test(name) ? 1 : 0,
      })))
    .sort((a, b) => b.priority - a.priority);

  return Response.json({ address: candidates[0]?.address || null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
