import os from "node:os";
import QRCode from "qrcode";
import type { NetIface } from "@iedc/shared";
import { NETWORK_LABELS } from "@iedc/data/network";

/** Friendly names for the subnets hotspots hand out. */
function labelFor(address: string, name: string): string {
  return NETWORK_LABELS.find((n) => address.startsWith(n.prefix))?.label ?? name;
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
  const known = (i: NetIface) => NETWORK_LABELS.findIndex((n) => i.address.startsWith(n.prefix));
  const score = (i: NetIface) => (known(i) === -1 ? NETWORK_LABELS.length : known(i));
  return out.sort((a, b) => score(a) - score(b));
}
