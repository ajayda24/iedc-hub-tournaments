/**
 * Network settings: internet checks and friendly names for hotspot networks.
 */

/** Phones try these; if any answers, the phone has internet and play freezes */
export const PHONE_PROBE_URLS = [
  "https://www.gstatic.com/generate_204",
  "https://cp.cloudflare.com/generate_204",
  "https://www.google.com/favicon.ico",
];

/** The arena laptop tries these to warn the host that the network leaks internet */
export const LAPTOP_PROBE_URLS = [
  "http://connectivitycheck.gstatic.com/generate_204",
  "http://www.msftconnecttest.com/connecttest.txt",
  "https://1.1.1.1/cdn-cgi/trace",
];

/** Labels for the laptop's networks in the Network doctor and on QR codes (first match wins) */
export const NETWORK_LABELS: { prefix: string; label: string }[] = [
  { prefix: "192.168.137.", label: "Laptop hotspot" },
  { prefix: "192.168.43.", label: "Android hotspot" },
  { prefix: "172.20.10.", label: "iPhone hotspot" },
];
