import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 기존 테스트는 한국어 메시지를 검증한다. 영어(기본값)는 tests/english.test.js 가 맡는다.
    env: { DESIGNSNITCH_LANG: "ko" },
  },
});
