import os from "node:os";
import QRCode from "qrcode";
import type { NetIface } from "@iedc/shared";

/** Friendly names for the subnets hotspots hand out. */
function labelFor(address: string, name: string): string {
  if (address.startsWith("192.168.137.")) return "Laptop hotspot";
  if (address.startsWith("192.168.43.")) return "Android hotspot";
  if (address.startsWith("172.20.10.")) return "iPhone hotspot";
  return name;
}

const qrCache = new Map<string, string>();
async function qrSvg(url: string): Promise<string> {
  const hit = qrCache.get(url);
  if (hit) return hit;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d1b16", light: "#00000000" } });
  qrCache.set(url, svg);
  return svg;
}

/** Every IPv4 address students could reach this laptop on, laptop hotspot first. */
export async function listInterfaces(port: number): Promise<NetIface[]> {
  const out: NetIface[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("169.254.")) continue; // link-local, nobody can use it
      const url = `http://${a.address}:${port}/play/`;
      out.push({ name, label: labelFor(a.address, name), address: a.address, url, qrSvg: await qrSvg(url) });
    }
  }
  const score = (i: NetIface) => (i.address.startsWith("192.168.137.") ? 0 : i.label.includes("hotspot") ? 1 : 2);
  return out.sort((a, b) => score(a) - score(b));
}
