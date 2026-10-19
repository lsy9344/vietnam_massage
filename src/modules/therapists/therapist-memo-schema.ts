import { z } from "zod";

/** 직원 패널의 내부 메모 추가 입력(스펙 D27). 본문은 빈 문자열을 막고, 2000자로 넉넉히 제한한다. */
export const addTherapistMemoSchema = z.object({
  employeeId: z.string().trim().min(1, "직원 ID가 필요합니다."),
  body: z.string().trim().min(1, "메모 내용을 입력하세요.").max(2000, "메모는 2000자 이하여야 합니다.")
});
