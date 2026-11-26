import { describe, expect, it } from "vitest";
import { checkCue, checkCues, CORRECT_FX, pickFx, WRONG_FX } from "../src/core/popups";

describe("superpower effects", () => {
  it("random never repeats the previous effect and covers every effect", () => {
    const seen = new Set<string>();
    let last: string | undefined;
    for (let i = 0; i < 400; i++) {
      const fx = pickFx("correct", "random", last);
      expect(fx).not.toBe(last);
      expect(CORRECT_FX.some((f) => f.id === fx)).toBe(true);
      seen.add(fx);
      last = fx;
    }
    expect(seen.size).toBe(CORRECT_FX.length);
    for (let i = 0; i < 100; i++) {
      const fx = pickFx("lastAttempt", undefined);
      expect(WRONG_FX.some((f) => f.id === fx)).toBe(true);
    }
  });
  it("a locked effect always plays", () => {
    expect(pickFx("wrong", "web", "web")).toBe("web");
    expect(pickFx("correct", "arrow")).toBe("arrow");
  });
  it("validation keeps known effects and falls back to random", () => {
    expect(checkCue({ fx: "blast" }, [], "correct").fx).toBe("blast");
    expect(checkCue({ fx: "blast" }, [], "wrong").fx).toBe("random"); // blast is correct-only
    expect(checkCue({ fx: "<script>" }, [], "wrong").fx).toBe("random");
    expect(checkCue({}, [], "outOfAttempts").fx).toBe("random");
    expect(checkCues({ correct: { fx: "portal" }, wrong: { fx: "dust" } }, [])).toMatchObject({ correct: { fx: "portal" }, wrong: { fx: "dust" } });
  });
});
