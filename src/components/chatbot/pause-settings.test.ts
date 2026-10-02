import { describe, expect, it } from "vitest";
import { describeMinutes } from "./pause-settings";

describe("describeMinutes", () => {
  it("prints the settings as people read them", () => {
    expect(describeMinutes(1440)).toBe("24 hours");
    expect(describeMinutes(120)).toBe("2 hours");
    expect(describeMinutes(60)).toBe("1 hour");
    expect(describeMinutes(90)).toBe("1 hour 30 minutes");
    expect(describeMinutes(45)).toBe("45 minutes");
    expect(describeMinutes(0)).toBe("1 minute");
  });
});
