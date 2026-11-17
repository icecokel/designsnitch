/** 클래스 교체 제안을 쓰는 규칙이 meta.messages 에 넣는 메시지. */
export const REPLACE_MESSAGES = { replace: "{{className}}(으)로 바꾸기" };

/**
 * 찾은 클래스를 후보 클래스로 바꾸는 제안 목록을 만든다.
 * 후보가 하나여도 자동 수정이 아니라 제안으로 둔다. 무엇으로 바꿀지는 쓰는 쪽이 정한다.
 * @param {[number, number]} range 찾은 클래스의 소스 범위
 * @param {string[]} classNames
 */
export function suggestClasses(range, classNames) {
  return classNames.map((className) => ({
    messageId: "replace",
    data: { className },
    fix: (fixer) => fixer.replaceTextRange(range, className),
  }));
}
