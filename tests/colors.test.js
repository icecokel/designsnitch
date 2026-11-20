import { describe, expect, it } from "vitest";
import { collectColors } from "../src/colors.js";
import { tempProject } from "./temp-project.js";

const files = {
  "src/A.tsx": [
    `export const A = () => (`,
    `  <div className="bg-[#3B82F6] text-[#3b82f6] border-[#FFF] bg-blue-500 hover:text-gray-700" style={{ color: "#3B82F6" }} />`,
    `);`,
  ].join("\n"),
  "src/B.tsx": [
    `// bg-[#000000] 은 주석이라 세지 않는다`,
    `export const b = cn("bg-[#3B82F6]", "bg-white", "not a color #fff here");`,
  ].join("\n"),
};

describe("collectColors", () => {
  it("코드에서 쓰는 hex 색과 기본 팔레트 색을 사용 횟수와 함께 모은다", async () => {
    const result = await collectColors({ cwd: tempProject(files) });

    expect(result.summary).toEqual({ files: 2, colors: 2, paletteColors: 3, uses: 8 });
    expect(result.colors).toEqual([
      {
        color: "#3b82f6",
        uses: 4,
        files: 2,
        utilities: { bg: 2, text: 1 },
        literals: 1,
        properties: {},
        examples: [
          { file: "src/A.tsx", line: 2 },
          { file: "src/B.tsx", line: 2 },
        ],
      },
      {
        color: "#ffffff",
        uses: 1,
        files: 1,
        utilities: { border: 1 },
        literals: 0,
        properties: {},
        examples: [{ file: "src/A.tsx", line: 2 }],
      },
    ]);
    expect(result.palette).toEqual([
      { name: "blue-500", uses: 1, files: 1, utilities: { bg: 1 }, examples: [{ file: "src/A.tsx", line: 2 }] },
      { name: "gray-700", uses: 1, files: 1, utilities: { text: 1 }, examples: [{ file: "src/A.tsx", line: 2 }] },
      { name: "white", uses: 1, files: 1, utilities: { bg: 1 }, examples: [{ file: "src/B.tsx", line: 2 }] },
    ]);
  });

  it("토큰이 주어지면 색마다 값이 같은 토큰을 붙인다", async () => {
    const result = await collectColors({
      cwd: tempProject(files),
      tokens: new Map([["#3b82f6", ["--color-primary"]]]),
    });
    expect(result.colors.map(({ color, tokens }) => ({ color, tokens }))).toEqual([
      { color: "#3b82f6", tokens: ["--color-primary"] },
      { color: "#ffffff", tokens: [] },
    ]);
  });

  it("프로젝트가 같은 이름의 토큰을 정의했으면 기본 팔레트로 세지 않는다", async () => {
    const result = await collectColors({
      cwd: tempProject(files),
      // --color-blue-500 을 프로젝트가 직접 정의했으므로 bg-blue-500 은 프로젝트 토큰이다.
      tokens: new Map([["#0000ff", ["--color-blue-500"]]]),
    });
    expect(result.palette.map((p) => p.name)).toEqual(["gray-700", "white"]);
    expect(result.summary).toMatchObject({ paletteColors: 2, uses: 7 });
  });

  it("예시 위치는 색마다 파일이 다른 것부터 3개까지만 담는다", async () => {
    const many = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`src/F${i}.jsx`, `export const c = "bg-[#123456] text-[#123456]";`]),
    );
    const result = await collectColors({ cwd: tempProject(many) });
    expect(result.colors[0]).toMatchObject({ uses: 10, files: 5 });
    expect(result.colors[0].examples).toEqual([
      { file: "src/F0.jsx", line: 1 },
      { file: "src/F1.jsx", line: 1 },
      { file: "src/F2.jsx", line: 1 },
    ]);
  });

  it("eslint-disable 주석이 있어도 빠뜨리지 않고, 파싱 못 한 파일은 건너뛴다", async () => {
    const result = await collectColors({
      cwd: tempProject({
        "src/A.jsx": `/* eslint-disable */\nexport const c = "bg-[#123456]";`,
        "src/Broken.jsx": `export const c = <div`,
      }),
    });
    expect(result.colors.map((c) => c.color)).toEqual(["#123456"]);
    expect(result.summary.files).toBe(2);
  });

  it("CSS 파일의 색도 속성별로 센다", async () => {
    const result = await collectColors({
      cwd: tempProject({
        "src/a.tsx": `export const a = "bg-[#3B82F6]";`,
        "src/a.css": `.a { color: #3b82f6; background-color: #3B82F6; }\n.b { color: #111; --x: #222222; }`,
        "dist/out.css": `.x { color: #999999; }`,
      }),
    });
    expect(result.summary).toEqual({ files: 2, colors: 3, paletteColors: 0, uses: 5 });
    expect(result.colors).toEqual([
      {
        color: "#3b82f6",
        uses: 3,
        files: 2,
        utilities: { bg: 1 },
        literals: 0,
        properties: { color: 1, "background-color": 1 },
        examples: [
          { file: "src/a.css", line: 1 },
          { file: "src/a.tsx", line: 1 },
        ],
      },
      {
        color: "#111111",
        uses: 1,
        files: 1,
        utilities: {},
        literals: 0,
        properties: { color: 1 },
        examples: [{ file: "src/a.css", line: 2 }],
      },
      {
        color: "#222222",
        uses: 1,
        files: 1,
        utilities: {},
        literals: 0,
        properties: { "--x": 1 },
        examples: [{ file: "src/a.css", line: 2 }],
      },
    ]);
  });
});

