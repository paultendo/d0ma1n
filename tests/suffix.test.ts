import { describe, expect, it } from "vitest";

import { splitDomain } from "../src/tld.js";

describe("splitDomain", () => {
  it("splits at the longest public suffix, not the last dot", () => {
    expect(splitDomain("bank.co.za")).toEqual({ label: "bank", tld: "co.za" });
    expect(splitDomain("bbc.co.uk")).toEqual({ label: "bbc", tld: "co.uk" });
    expect(splitDomain("example.com.au")).toEqual({ label: "example", tld: "com.au" });
    expect(splitDomain("paypal.com")).toEqual({ label: "paypal", tld: "com" });
    expect(splitDomain("nhs.uk")).toEqual({ label: "nhs", tld: "uk" });
  });
});
