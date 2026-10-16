// Tampilan IP di daftar sesi (ACC-007). Better Auth menyimpan IPv6 sebagai prefiks /64 dalam bentuk panjang
// (`2001:0db8:0000:…:0000`) → diringkas ke notasi standar (RFC 5952). Alamat kosong `::` (mis. loopback lokal yang
// dimasker) tidak bermakna → `null` (disembunyikan).
export function formatIp(ip: string | null): string | null {
  if (!ip) return null;
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const groups = ip.split(":");
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return ip;
  const short = groups.map((group) => group.replace(/^0+(?=.)/, "").toLowerCase());
  // Deret nol terpanjang (≥ 2 grup) diganti `::`.
  let best = { start: -1, length: 0 };
  for (let i = 0; i < 8; ) {
    if (short[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && short[j] === "0") j++;
    if (j - i > best.length && j - i >= 2) best = { start: i, length: j - i };
    i = j;
  }
  if (best.start < 0) return short.join(":");
  const head = short.slice(0, best.start).join(":");
  const tail = short.slice(best.start + best.length).join(":");
  const compressed = `${head}::${tail}`;
  return compressed === "::" ? null : compressed;
}
