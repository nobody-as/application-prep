export function publicUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !host.includes(".") ||
    host.includes(":") ||
    /^[\d.]+$/.test(host) ||
    /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
    host.endsWith(".localhost")
  )
    throw new Error("Use a public HTTPS page URL.");
  return url;
}
export function publicIPv4(value: string) {
  const p = value.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  const [a, b] = p;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}
export function publicIPv6(value: string) {
  // Fail closed for special ranges and mapped/embedded IPv4.
  const s = value.toLowerCase();
  return (
    /^[23][0-9a-f]{3}:/.test(s) &&
    !s.startsWith("2001:db8:") &&
    !s.startsWith("2001:0:") &&
    !s.startsWith("2002:") &&
    !s.startsWith("2001:2:")
  );
}
export async function resolvePublicHost(host: string) {
  const answers = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const r = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
        {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!r.ok) throw new Error("Could not verify the page address.");
      const data = (await r.json()) as {
        Answer?: { type: number; data: string }[];
      };
      return (data.Answer || []).filter((a) => a.type === 1 || a.type === 28);
    }),
  );
  const ips = answers.flat();
  if (
    !ips.length ||
    ips.some((a) => (a.type === 1 ? !publicIPv4(a.data) : !publicIPv6(a.data)))
  )
    throw new Error("The page address is not a supported public host.");
}
