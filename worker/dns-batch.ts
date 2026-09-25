import { connect } from "cloudflare:sockets";

/**
 * DNS over TLS to 1.1.1.1, many queries on one connection. A Worker may only make so many outgoing requests per
 * invocation, and a socket counts as one however many queries it carries, so a whole scan's lookups cost one.
 * Queries use the standard DNS wire format (RFC 1035) with the two-byte length prefix TCP needs (RFC 7766).
 */

export const TYPE_NS = 2;
export const TYPE_MX = 15;

export type BatchAnswer = { rcode: number; ns: string[]; mx: { priority: number; exchange: string }[] };

function encodeQuery(id: number, name: string, type: number): Uint8Array {
  const labels = name.replace(/\.$/, "").split(".");
  const qname = labels.reduce((n, l) => n + 1 + l.length, 1);
  const msg = new Uint8Array(2 + 12 + qname + 4);
  const v = new DataView(msg.buffer);
  v.setUint16(0, 12 + qname + 4);
  v.setUint16(2, id);
  v.setUint16(4, 0x0100); // recursion desired
  v.setUint16(6, 1); // one question
  let o = 14;
  for (const l of labels) {
    msg[o++] = l.length;
    for (let i = 0; i < l.length; i++) msg[o++] = l.charCodeAt(i);
  }
  msg[o++] = 0;
  v.setUint16(o, type);
  v.setUint16(o + 2, 1); // class IN
  return msg;
}

/** A domain name at `offset`, following compression pointers; returns the name and the offset after it. */
function readName(buf: Uint8Array, offset: number): [string, number] {
  const parts: string[] = [];
  let o = offset;
  let end = -1;
  for (let guard = 0; guard < 128; guard++) {
    const len = buf[o]!;
    if (len === 0) { o++; break; }
    if ((len & 0xc0) === 0xc0) {
      if (end < 0) end = o + 2;
      o = ((len & 0x3f) << 8) | buf[o + 1]!;
      continue;
    }
    parts.push(String.fromCharCode(...buf.subarray(o + 1, o + 1 + len)));
    o += 1 + len;
  }
  return [parts.join("."), end >= 0 ? end : o];
}

function decodeAnswer(msg: Uint8Array): { id: number; answer: BatchAnswer } {
  const v = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const id = v.getUint16(0);
  const rcode = v.getUint16(2) & 0x0f;
  const qd = v.getUint16(4), an = v.getUint16(6);
  let o = 12;
  for (let i = 0; i < qd; i++) o = readName(msg, o)[1] + 4;
  const answer: BatchAnswer = { rcode, ns: [], mx: [] };
  for (let i = 0; i < an && o < msg.length; i++) {
    o = readName(msg, o)[1];
    const type = v.getUint16(o), rdlen = v.getUint16(o + 8);
    const rd = o + 10;
    if (type === TYPE_NS) answer.ns.push(readName(msg, rd)[0]);
    if (type === TYPE_MX) answer.mx.push({ priority: v.getUint16(rd), exchange: readName(msg, rd + 2)[0] });
    o = rd + rdlen;
  }
  return { id, answer };
}

/** Ask every query over one DNS-over-TLS connection. Unanswered queries are missing from the result. */
export async function batchQuery(queries: { name: string; type: number }[], timeoutMs = 5000): Promise<(BatchAnswer | undefined)[]> {
  const results: (BatchAnswer | undefined)[] = new Array(queries.length);
  if (queries.length === 0) return results;
  const socket = connect({ hostname: "1.1.1.1", port: 853 }, { secureTransport: "on" });
  try {
    const writer = socket.writable.getWriter();
    const out = queries.map((q, i) => encodeQuery(i, q.name, q.type));
    const all = new Uint8Array(out.reduce((n, m) => n + m.length, 0));
    let w = 0;
    for (const m of out) { all.set(m, w); w += m.length; }
    await writer.write(all);

    const reader = socket.readable.getReader();
    let pending = new Uint8Array(0);
    let answered = 0;
    const deadline = Date.now() + timeoutMs;
    while (answered < queries.length && Date.now() < deadline) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((r) => setTimeout(() => r({ done: true, value: undefined }), deadline - Date.now())),
      ]);
      if (chunk.done || !chunk.value) break;
      const merged = new Uint8Array(pending.length + chunk.value.length);
      merged.set(pending); merged.set(chunk.value, pending.length);
      pending = merged;
      while (pending.length >= 2) {
        const len = (pending[0]! << 8) | pending[1]!;
        if (pending.length < 2 + len) break;
        const { id, answer } = decodeAnswer(pending.slice(2, 2 + len));
        if (id < results.length && !results[id]) { results[id] = answer; answered++; }
        pending = pending.slice(2 + len);
      }
    }
  } finally {
    try { await socket.close(); } catch { /* already closed */ }
  }
  return results;
}
