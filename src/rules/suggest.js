import { messages, resolveLang } from "../messages.js";

/** 규칙의 문장은 실행할 때 언어에 맞춰 만든다. meta.messages 에는 자리만 둔다. */
export const TEXT = "{{text}}";

/** 규칙이 쓸 언어의 문장들. settings.designsnitch.lang, 환경 변수, 영어 순으로 정한다. */
export function ruleMessages(context) {
  return messages(resolveLang(context.settings?.designsnitch?.lang));
}

/**
 * 찾은 클래스를 후보 클래스로 바꾸는 제안 목록을 만든다.
 * 후보가 하나여도 자동 수정이 아니라 제안으로 둔다. 무엇으로 바꿀지는 쓰는 쪽이 정한다.
 * @param {[number, number]} range 찾은 클래스의 소스 범위
 * @param {string[]} classNames
 * @param {ReturnType<typeof messages>} m
 */
export function suggestClasses(range, classNames, m) {
  return classNames.map((className) => ({
    messageId: "replace",
    data: { text: m.replaceWith({ className }) },
    fix: (fixer) => fixer.replaceTextRange(range, className),
  }));
}
