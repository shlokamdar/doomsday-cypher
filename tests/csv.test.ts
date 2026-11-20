import { describe, expect, it } from "vitest";
import { BREACH_TEMPLATE, parseBreachImport, parseCsv, parseSquadCsv } from "../src/core/csv";
import { DEFAULT_CHALLENGE_TYPES } from "../src/core/themes";

describe("CSV", () => {
  it("parses quotes, commas and newlines", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,"multi\nline",3')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "multi\nline", "3"],
    ]);
  });

  it("imports breaches and reports errors per row", () => {
    const csv = [
      "title,type,theme,points,flag,description,hint,hint_cost,attempts,files",
      'Good one,Recruit,Signal,100,DC{x},"Desc, with comma",Look up,,3,a.txt|https://e.org/a.txt;b|/b.bin',
      "No points,Recruit,Signal,,DC{y},,,,,",
      "Bad type,Wizard,Signal,50,DC{z},,,,,",
      "Bad theme,Agent,Ocean,50,DC{z},,,,,",
      "No flag,Agent,Void,50,,,,,,",
      "Bad files,Agent,Void,50,DC{q},,,,,justaname",
      "Bad attempts,Agent,Void,50,DC{q},,,,-1,",
    ].join("\n");
    const { rows, errors } = parseBreachImport(csv, DEFAULT_CHALLENGE_TYPES);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Good one",
      typeId: "t-recruit",
      theme: "signal",
      points: 100,
      maxAttempts: 3,
      hints: [{ text: "Look up", cost: 10 }],
      files: [
        { name: "a.txt", url: "https://e.org/a.txt" },
        { name: "b", url: "/b.bin" },
      ],
    });
    expect(errors.map((e) => e.row)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(errors[0].message).toMatch(/Points/);
    expect(errors[1].message).toMatch(/Unknown category/);
    expect(errors[2].message).toMatch(/Unknown theme/);
    expect(errors[3].message).toMatch(/Flag is required/);
  });

  it("reports a missing header and unclosed quotes", () => {
    expect(parseBreachImport("name,score\nx,1", DEFAULT_CHALLENGE_TYPES).errors[0].message).toMatch(/missing: title, points, flag/);
    expect(parseBreachImport('title,points,flag\n"oops,1,x', DEFAULT_CHALLENGE_TYPES).errors[0].message).toMatch(/Unclosed quote/);
  });

  it("the template parses cleanly", () => {
    expect(parseBreachImport(BREACH_TEMPLATE, DEFAULT_CHALLENGE_TYPES).errors).toEqual([]);
  });

  it("imports JSON too", () => {
    const { rows, errors } = parseBreachImport(
      JSON.stringify([{ title: "J", type: "Elite", theme: "void", points: 300, flag: "DC{j}", hints: [{ text: "h", cost: 5 }] }]),
      DEFAULT_CHALLENGE_TYPES,
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ typeId: "t-elite", theme: "void", hints: [{ text: "h", cost: 5 }] });
  });

  it("parses squad CSV", () => {
    const { rows, errors } = parseSquadCsv("team,member1,member2,member3\nA,x,y\nB\nC,1,2,3,4", 3);
    expect(rows).toEqual([{ team: "A", members: ["x", "y"] }]);
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
  });
});
