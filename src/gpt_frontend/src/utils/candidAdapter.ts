import { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";

/**
 * A Visitor that traverses the IDL definition and the input data simultaneously.
 * It normalizes the input data to strictly match the structure expected by the
 * @dfinity/candid serializer.
 *
 * Features:
 * - Auto-converts numbers to BigInt for int/nat types.
 * - Auto-converts strings to Principals.
 * - Handles Optionals:
 *   - undefined/null -> []
 *   - Value -> [Value]
 *   - Legacy [Value] -> [Value] (Prevents double wrapping)
 * - Optimizes Blob (vec nat8) handling.
 * - Supports Variant string shorthand.
 */
export class AutoCandidAdapter extends IDL.Visitor<any, any> {
  public visitRecord(
    t: IDL.RecordClass,
    fields: [string, IDL.Type<any>][],
    data: any,
  ): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }
    const result: any = {};
    fields.forEach(([key, type]) => {
      const value = data[key];
      result[key] = type.accept(this, value);
    });
    return result;
  }

  public visitOpt(t: IDL.OptClass<any>, type: IDL.Type<any>, data: any): any {
    // 1. Handle missing values -> None
    if (data === undefined || data === null) {
      return [];
    }

    // 2. Handle explicit None (empty array)
    if (Array.isArray(data) && data.length === 0) {
      return [];
    }

    // 3. Handle Legacy/Manual Wrapping (Array of 1 item)
    // If the input is already an array, and the inner type is NOT a vector,
    // we assume it is an existing manual Option wrapper (e.g. ["2025"]).
    // We unwrap it, visit the inner value, and re-wrap.
    if (Array.isArray(data) && !(type instanceof IDL.VecClass)) {
      if (data.length > 0) {
        return [type.accept(this, data[0])];
      }
      return [];
    }

    // 4. Handle Raw Value -> Some(Value)
    // The input is a raw value (e.g. "2025"). Visit it and wrap it.
    return [type.accept(this, data)];
  }

  public visitVec(t: IDL.VecClass<any>, type: IDL.Type<any>, data: any): any {
    // Optimization for Blobs (vec nat8)
    if (type.display() === "nat8") {
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      if (Array.isArray(data)) {
        return new Uint8Array(data);
      }
      return data;
    }

    if (!Array.isArray(data)) {
      // Fallback: if we expect a vec but get non-array, return empty to prevent crash,
      // or let it fail if strictness is required. Returning [] is safer for UI.
      return [];
    }

    return data.map((e) => type.accept(this, e));
  }

  public visitRec(
    t: IDL.RecClass<any>,
    ty: IDL.ConstructType<any>,
    data: any,
  ): any {
    return ty.accept(this, data);
  }

  public visitPrincipal(t: IDL.PrincipalClass, data: any): any {
    if (typeof data === "string") {
      try {
        return Principal.fromText(data);
      } catch {
        return data;
      }
    }
    return data;
  }

  public visitPrimitive(t: IDL.PrimitiveType<any>, data: any): any {
    if (data === undefined || data === null) return data;

    // Auto-convert numbers/strings to BigInt for Candid int types
    if (["int", "int64", "nat", "nat64"].includes(t.display())) {
      if (typeof data === "number") {
        return BigInt(data);
      }
      if (typeof data === "string") {
        try {
          return BigInt(data);
        } catch {
          return BigInt(0);
        }
      }
    }
    return data;
  }

  public visitTuple(
    t: IDL.TupleClass<any>,
    components: IDL.Type<any>[],
    data: any,
  ): any {
    if (!Array.isArray(data)) return data;
    return data.map((val, i) =>
      components[i] ? components[i].accept(this, val) : val,
    );
  }

  public visitVariant(
    t: IDL.VariantClass,
    fields: [string, IDL.Type<any>][],
    data: any,
  ): any {
    // 1. Support string shorthand for null-variants (e.g. "Active")
    if (typeof data === "string") {
      const field = fields.find(([k]) => k === data);
      if (field && field[1].display() === "null") {
        return { [data]: null };
      }
    }

    // 2. Standard Object format { Key: Value }
    if (typeof data === "object" && data !== null) {
      const keys = Object.keys(data);
      // Pass through if it looks like a valid variant (1 key)
      if (keys.length === 1) {
        const key = keys[0];
        const field = fields.find(([k]) => k === key);
        if (field) {
          // Recurse into the payload
          return { [key]: field[1].accept(this, data[key]) };
        }
      }
    }
    return data;
  }

  public visitType<T>(t: IDL.Type<T>, data: any): any {
    return t.accept(this, data);
  }
}

/**
 * Normalizes an array of arguments against the IDL definition of a canister method.
 * @param idlFactory The IDL factory function from the .did.js file.
 * @param methodName The name of the method to call.
 * @param args The raw arguments from the frontend.
 * @returns An array of normalized arguments ready for the Actor.
 */
export const normalizePayload = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  idlFactory: any,
  methodName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] => {
  const service = idlFactory({ IDL });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const methodDef = service._fields.find(
    ([name]: [string, any]) => name === methodName,
  );

  if (!methodDef) {
    console.warn(
      `[CandidAdapter] Method '${methodName}' not found in IDL. Passing args through raw.`,
    );
    return args;
  }

  const func: IDL.FuncClass = methodDef[1];
  const argTypes: IDL.Type<any>[] = func.argTypes;
  const adapter = new AutoCandidAdapter();

  return args.map((arg, i) => {
    const type = argTypes[i];
    if (!type) return arg;
    return type.accept(adapter, arg);
  });
};
