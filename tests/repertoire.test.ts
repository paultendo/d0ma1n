import { describe, expect, it } from "vitest";

import { outsideRepertoire, registryRule } from "../src/policy/repertoire.js";

describe("registry character rules", () => {
  it("accepts characters in one of the registry's tables", () => {
    expect(outsideRepertoire("gᴏogle", "com")).toEqual([]); // U+1D0F, Verisign Latin
    expect(outsideRepertoire("googlɵ", "com")).toEqual([]);
  });

  it("rejects characters no table lists", () => {
    expect(outsideRepertoire("ɡoogle", "com")).toEqual(["ɡ"]); // U+0261 is not in .com's tables
  });

  it("requires the label to fit a single table, not the union", () => {
    // Latin é and Cyrillic а each appear in some .com table, but never together
    expect(outsideRepertoire("é", "com")).toEqual([]);
    expect(outsideRepertoire("а", "com")).toEqual([]);
    expect(outsideRepertoire("éа", "com")!.length).toBeGreaterThan(0);
  });

  it("treats a generic TLD with no lodged tables as ASCII-only", () => {
    expect(registryRule("gov").kind).toBe("ascii");
    expect(outsideRepertoire("gооgle", "gov")).toEqual(["о", "о"]);
    expect(outsideRepertoire("google", "gov")).toEqual([]);
  });

  it("keeps only the Latin tables for .eu", () => {
    expect(outsideRepertoire("é", "eu")).toEqual([]);
    expect(outsideRepertoire("а", "eu")).toEqual(["а"]);
  });

  it("reads IDN TLDs in either form and multi-part suffixes by their registry", () => {
    expect(registryRule(".COM").kind).toBe("tables");
    expect(registryRule("co.jp").kind).toBe(registryRule("jp").kind);
    expect(registryRule("xn--p1ai").kind).toBe(registryRule("рф").kind);
  });

  it("leaves TLDs with no known rules undefined", () => {
    expect(registryRule("notatld").kind).toBe("unknown");
    expect(outsideRepertoire("gᴏogle", "notatld")).toBeUndefined();
  });
});

describe("country-code registries researched outside IANA", () => {
  it("uses DENIC's list for .de", () => {
    expect(outsideRepertoire("müller", "de")).toEqual([]);
    expect(outsideRepertoire("gооgle", "de")).toEqual(["о", "о"]); // Cyrillic о
  });

  it("treats registries that take ASCII only as such", () => {
    expect(registryRule("uk").kind).toBe("ascii");
    expect(registryRule("co.uk").kind).toBe("ascii");
    expect(outsideRepertoire("gᴏogle", "co.uk")).toEqual(["ᴏ"]);
  });

  it("takes Cyrillic under .рф but not Latin lookalikes", () => {
    expect(outsideRepertoire("пример", "рф")).toEqual([]);
    expect(outsideRepertoire("é", "рф")).toEqual(["é"]);
  });

  it("lets a label fit either of .mo's two tables but not both at once", () => {
    expect(outsideRepertoire("ção", "mo")).toEqual([]);
    expect(outsideRepertoire("澳門", "mo")).toEqual([]);
    expect(outsideRepertoire("ç澳", "mo")!.length).toBe(1);
  });
});

describe("unchecked Latin country codes", () => {
  it("are assumed ASCII-only, and say so", () => {
    expect(registryRule("tv")).toEqual({ kind: "ascii", assumed: true });
    expect(registryRule("de")).toMatchObject({ kind: "tables" });
  });

  it("leave unchecked IDN country codes unknown", () => {
    expect(registryRule("xn--mgbpl2fh").kind).toBe("unknown"); // .سودان
  });
});
