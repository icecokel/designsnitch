/**
 * 직접 쓴 색을 후보로 바꿔도 화면이 같다고 볼 수 있는가.
 * 검사 결과의 action "replace" 와 ESLint 의 자동 수정(--fix)이 같은 판정을 쓴다.
 * 반투명(useTokenAlpha), 테마마다 값이 다른 토큰(useTokenThemed), 스타일이 아닌 자리(useTokenData)는
 * 다른 messageId 로 보고되므로 여기에 들지 않는다. 후보가 여럿이면 사람이 고른다.
 * @param {string | undefined} messageId
 * @param {number} candidateCount
 */
export function isSafeColorReplace(messageId, candidateCount) {
  return messageId === "useToken" && candidateCount === 1;
}
