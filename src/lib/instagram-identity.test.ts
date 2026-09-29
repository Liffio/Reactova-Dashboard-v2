import { describe, expect, it } from "vitest";
import { instagramIdentity, realHandle, UNKNOWN_PERSON } from "./instagram-identity";

const ID = "17841402123456789";

describe("realHandle", () => {
  it("keeps a real username, without the @", () => {
    expect(realHandle("@sam.jones", ID)).toBe("sam.jones");
    expect(realHandle("sam.jones", ID)).toBe("sam.jones");
  });

  it("drops the Instagram id standing in for an unknown username", () => {
    expect(realHandle(ID, ID)).toBeNull();
    expect(realHandle(`@${ID}`, ID)).toBeNull();
  });

  it("drops the comment lane's @-plus-8-characters stub", () => {
    expect(realHandle(`@${ID.slice(0, 8)}`, ID)).toBeNull();
  });

  it("is null for nothing", () => {
    expect(realHandle(null, ID)).toBeNull();
    expect(realHandle("  ", ID)).toBeNull();
  });
});

describe("instagramIdentity", () => {
  it("name first, @username second", () => {
    expect(
      instagramIdentity({ igUserId: ID, igUsername: "sam.jones", displayName: "Sam Jones" }),
    ).toEqual({
      primary: "Sam Jones",
      secondary: "@sam.jones",
      initial: "S",
      withheld: false,
    });
  });

  it("@username alone when there is no name", () => {
    expect(instagramIdentity({ igUserId: ID, igUsername: "sam.jones" })).toMatchObject({
      primary: "@sam.jones",
      secondary: null,
      initial: "S",
    });
  });

  it("never shows the id: 'Instagram user', no initial (a person icon instead)", () => {
    expect(instagramIdentity({ igUserId: ID, igUsername: ID })).toEqual({
      primary: UNKNOWN_PERSON,
      secondary: null,
      initial: null,
      withheld: false,
    });
  });

  it("marks it withheld only when Instagram declined, not while the lookup is pending", () => {
    expect(instagramIdentity({ igUserId: ID, profileStatus: "no_consent" }).withheld).toBe(true);
    expect(instagramIdentity({ igUserId: ID, profileStatus: "failed" }).withheld).toBe(true);
    expect(instagramIdentity({ igUserId: ID, profileStatus: "queued" }).withheld).toBe(false);
    expect(instagramIdentity({ igUserId: ID, profileStatus: null }).withheld).toBe(false);
    expect(
      instagramIdentity({ igUserId: ID, igUsername: "sam", profileStatus: "no_consent" }).withheld,
    ).toBe(false);
  });
});
