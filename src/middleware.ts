import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { shouldBlockWrite } from "@/lib/maintenance-mode";

export function middleware(request: NextRequest) {
  if (shouldBlockWrite(request.method)) {
    return new NextResponse("데이터 이전 중입니다. 잠시 후 다시 시도해 주세요.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "300"
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
