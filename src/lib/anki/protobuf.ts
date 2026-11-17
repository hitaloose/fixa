/**
 * Minimal protobuf reader for the config blobs in Anki's schema-18 collections. Only what the
 * import needs: varints, length-delimited fields and 32-bit floats. Field numbers come from
 * Anki's .proto files (docs/08-import-export.md).
 */
export type ProtoFields = Map<number, Array<bigint | Uint8Array>>;

const decoder = new TextDecoder();

export function decodeProto(bytes: Uint8Array): ProtoFields {
  const fields: ProtoFields = new Map();
  let pos = 0;
  const varint = (): bigint => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (pos >= bytes.length) throw new Error("truncated varint");
      const byte = bytes[pos++] as number;
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
    }
  };
  const take = (n: number) => {
    if (pos + n > bytes.length) throw new Error("truncated field");
    const slice = bytes.subarray(pos, pos + n);
    pos += n;
    return slice;
  };
  while (pos < bytes.length) {
    const key = Number(varint());
    const field = key >>> 3;
    const wire = key & 7;
    let value: bigint | Uint8Array;
    if (wire === 0) value = varint();
    else if (wire === 1) value = take(8);
    else if (wire === 2) value = take(Number(varint()));
    else if (wire === 5) value = take(4);
    else throw new Error(`unsupported wire type ${wire}`);
    fields.set(field, [...(fields.get(field) ?? []), value]);
  }
  return fields;
}

const last = (fields: ProtoFields, n: number) => fields.get(n)?.at(-1);

/** int64/uint32 fields (0 when absent, as proto3 omits defaults). */
export function protoNumber(fields: ProtoFields, n: number): number {
  const v = last(fields, n);
  return typeof v === "bigint" ? Number(BigInt.asIntN(64, v)) : 0;
}

export const protoBool = (fields: ProtoFields, n: number) => protoNumber(fields, n) !== 0;

export function protoString(fields: ProtoFields, n: number): string {
  const v = last(fields, n);
  return v instanceof Uint8Array ? decoder.decode(v) : "";
}

export function protoMessage(fields: ProtoFields, n: number): ProtoFields | null {
  const v = last(fields, n);
  return v instanceof Uint8Array ? decodeProto(v) : null;
}

const f32 = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true);

export function protoFloat(fields: ProtoFields, n: number): number | undefined {
  const v = last(fields, n);
  return v instanceof Uint8Array && v.length === 4 ? f32(v) : undefined;
}

/** repeated float, packed (one length-delimited blob) or not. */
export function protoFloats(fields: ProtoFields, n: number): number[] {
  return (fields.get(n) ?? []).flatMap((v) => {
    if (!(v instanceof Uint8Array)) return [];
    const out: number[] = [];
    for (let i = 0; i + 4 <= v.length; i += 4) out.push(f32(v.subarray(i, i + 4)));
    return out;
  });
}

export function protoMessages(fields: ProtoFields, n: number): ProtoFields[] {
  return (fields.get(n) ?? []).flatMap((v) => (v instanceof Uint8Array ? [decodeProto(v)] : []));
}
