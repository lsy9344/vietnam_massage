/**
 * 같은 선택자에 걸리는 노드 중 실제로 보이는 것 하나를 고른다. 접힌 완료 묶음의 줄처럼 숨은 노드를
 * `querySelector`가 먼저 찾으면 스크롤·포커스 복귀가 틀린 노드를 집는다. 원장 작업면과 빠른 예약 패널(저장 직후 새 줄을
 * 고를 때)이 같이 쓴다.
 */
export function firstVisible<T extends Element>(selector: string): T | null {
  const nodes = document.querySelectorAll<T>(selector);
  for (const node of nodes) {
    if (node instanceof HTMLElement && node.offsetParent !== null) {
      return node;
    }
  }
  return nodes[0] ?? null;
}
