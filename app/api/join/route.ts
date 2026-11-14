import { networkInterfaces } from "os";
import QRCode from "qrcode";

// First real LAN address (skips loopback, docker bridges, VPNs).
function lanIp() {
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (/^(lo|br-|docker|veth|tailscale|tun|virbr)/.test(name)) continue;
    const a = addrs?.find((x) => x.family === "IPv4" && !x.internal);
    if (a) return a.address;
  }
}

// Join URL for phones + QR code. A screen opened on localhost still gets the LAN URL.
export async function GET(request: Request) {
  let host = request.headers.get("host") ?? "localhost:3000";
  const [name, port] = host.split(":");
  if (name === "localhost" || name === "127.0.0.1")
    host = `${lanIp() ?? name}${port ? `:${port}` : ""}`;
  const url = `http://${host}`;
  return Response.json({ url, qr: await QRCode.toString(url, { type: "svg", margin: 1 }) });
}
