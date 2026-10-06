/**
 * Precompiled Yoga layout engine for @react-pdf/renderer on Workers.
 *
 * yoga-layout ships its WebAssembly as a base64 string and compiles it at runtime with
 * `WebAssembly.instantiate(bytes)`. Workers forbid compiling WebAssembly from bytes at
 * runtime; modules must be uploaded with the Worker. `scripts/cloudflare/prepare.ts`
 * extracts the exact same binary from node_modules into cloudflare/.generated/yoga.wasm
 * at build time, wrangler uploads it as a compiled module, and this patch hands that
 * module to Yoga when (and only when) the bytes Yoga passes in are byte-identical
 * (length + SHA-256). Any other instantiate call goes to the original implementation.
 */
// @ts-expect-error -- generated at build time; wrangler imports .wasm as a WebAssembly.Module
import yogaModule from "./.generated/yoga.wasm";
// @ts-expect-error -- generated at build time
import { YOGA_WASM_BYTES, YOGA_WASM_SHA256 } from "./.generated/yoga-meta.js";

type Source = ArrayBuffer | ArrayBufferView | WebAssembly.Module;

function bytesOf(source: Source): Uint8Array | null {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return null;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let installed = false;
export function installPrecompiledWasm() {
  if (installed) return;
  installed = true;
  const original = WebAssembly.instantiate.bind(WebAssembly) as (s: Source, i?: WebAssembly.Imports) => Promise<unknown>;
  const patched = async (source: Source, imports?: WebAssembly.Imports) => {
    const bytes = bytesOf(source);
    if (bytes && bytes.byteLength === YOGA_WASM_BYTES && (await sha256Hex(bytes)) === YOGA_WASM_SHA256) {
      const instance = await WebAssembly.instantiate(yogaModule as WebAssembly.Module, imports);
      return { module: yogaModule, instance };
    }
    return original(source, imports);
  };
  // `WebAssembly.instantiate(module, imports)` (used just above) still reaches the original:
  // the patched function only intercepts byte sources that match Yoga.
  (WebAssembly as unknown as { instantiate: unknown }).instantiate = (source: Source, imports?: WebAssembly.Imports) =>
    source instanceof WebAssembly.Module ? original(source, imports) : patched(source, imports);
}
