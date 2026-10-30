import { describe, expect, it } from "vitest";
import { parseMethodFrom } from "@/components/marketing/MethodViewTracker";
import { METHOD_FROM } from "@/lib/config/method";

describe("parseMethodFrom (UI spec §5.2)", () => {
  it("kapalı listedeki değerler aynen", () => {
    for (const f of METHOD_FROM) expect(parseMethodFrom(f)).toBe(f);
  });
  it("bilinmeyen, dizi veya boş değer direct olur", () => {
    expect(parseMethodFrom("x@y.com")).toBe("direct");
    expect(parseMethodFrom(["guide"])).toBe("direct");
    expect(parseMethodFrom(undefined)).toBe("direct");
    expect(parseMethodFrom("")).toBe("direct");
  });
});
