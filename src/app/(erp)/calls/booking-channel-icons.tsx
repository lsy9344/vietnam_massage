import type { ReactNode } from "react";
import type { CustomerDto } from "@/modules/calls/service-call-service";

export type BookingChannelType =
  | "전화"
  | "텔레그램"
  | "카카오톡"
  | "잘로"
  | "왓츠앱"
  | "위챗"
  | "워크인"
  | "기타";

export function BookingChannelIcon({
  channel,
  className = "w-7 h-7"
}: {
  channel: string;
  className?: string;
}) {
  const norm = (channel || "").trim().toLowerCase();

  if (norm.includes("전화") || norm.includes("phone")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#0066FF] text-white shadow-xs ${className}`}
        title="전화"
      >
        <svg className="w-[58%] h-[58%]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.74 21 3 13.26 3 3.99a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.21 2.21z" />
        </svg>
      </div>
    );
  }

  if (norm.includes("텔레") || norm.includes("tele")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#0088CC] text-white shadow-xs ${className}`}
        title="텔레그램"
      >
        <svg className="w-[60%] h-[60%] -translate-x-[1px] translate-y-[1px]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .36z" />
        </svg>
      </div>
    );
  }

  if (norm.includes("카카오") || norm.includes("kakao")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#FEE500] text-[#3C1E1E] shadow-xs ${className}`}
        title="카카오톡"
      >
        <div className="relative flex items-center justify-center w-full h-full">
          <svg className="w-[78%] h-[78%]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.558 1.708 4.8 4.27 6.054l-1.087 4.004c-.097.357.307.647.604.45l4.802-3.17c.136.01.274.017.411.017 4.97 0 9-3.185 9-7.115S16.97 3 12 3z" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-[#FEE500] tracking-tighter -mt-[1px]">
            TALK
          </span>
        </div>
      </div>
    );
  }

  if (norm.includes("잘로") || norm.includes("zalo")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#0068FF] text-white shadow-xs font-bold text-[10px] tracking-tight ${className}`}
        title="잘로"
      >
        Zalo
      </div>
    );
  }

  if (norm.includes("왓츠") || norm.includes("whats")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-xs ${className}`}
        title="왓츠앱"
      >
        <svg className="w-[62%] h-[62%]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.68-1.4 1.25-1.93 1.33-.5.07-1.15.11-3.32-.78-2.67-1.1-4.4-3.79-4.53-3.97-.13-.18-1.07-1.43-1.07-2.73 0-1.3.68-1.94.92-2.2.24-.26.53-.33.71-.33.18 0 .36 0 .52.01.17.01.39-.06.61.47.23.55.78 1.91.85 2.05.07.14.12.3.02.48-.1.19-.15.31-.3.48-.15.18-.32.4-.46.54-.15.15-.31.32-.13.63.18.31.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.46 1.51.31.15.49.13.67-.08.18-.21.78-.91.99-1.22.21-.31.42-.26.71-.15.29.11 1.84.87 2.16 1.03.32.16.53.24.61.37.08.13.08.77-.16 1.45z" />
        </svg>
      </div>
    );
  }

  if (norm.includes("위챗") || norm.includes("wechat")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#07C160] text-white shadow-xs ${className}`}
        title="위챗"
      >
        <svg className="w-[66%] h-[66%]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.5 4.5C4.36 4.5 1 7.41 1 11c0 1.97 1.01 3.74 2.6 4.93l-.65 2.45a.5.5 0 00.73.54l2.84-1.42c.63.17 1.3.26 1.98.26.25 0 .5-.02.74-.05-.47-.94-.74-2-.74-3.13 0-4.04 3.73-7.32 8.35-7.32.22 0 .43.01.65.03C16.14 5.53 12.56 4.5 8.5 4.5zm-2.25 4a1 1 0 110 2 1 1 0 010-2zm4.5 0a1 1 0 110 2 1 1 0 010-2zm5.75 3.25c-3.59 0-6.5 2.57-6.5 5.75 0 1.74.87 3.3 2.25 4.35l-.57 2.15a.4.4 0 00.58.43l2.49-1.24c.56.16 1.15.24 1.75.24 3.59 0 6.5-2.57 6.5-5.75s-2.91-5.93-6.5-5.93zm-2 3.5a.85.85 0 110 1.7.85.85 0 010-1.7zm4 0a.85.85 0 110 1.7.85.85 0 010-1.7z" />
        </svg>
      </div>
    );
  }

  if (norm.includes("워크") || norm.includes("walk")) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#FF6600] text-white shadow-xs ${className}`}
        title="워크인"
      >
        <svg className="w-[60%] h-[60%]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-[#5A6B7C] text-white shadow-xs font-bold text-[9px] tracking-tight ${className}`}
      title="기타"
    >
      etc
    </div>
  );
}

export function parseCustomerCallInfo(
  row: {
    customerMemo?: string | null;
    note?: string | null;
    customerId?: string | null;
    customer?: { name: string; phone?: string | null } | null;
  },
  customers?: CustomerDto[]
) {
  let channel = "기타";
  let name = "-";
  let contact = "-";
  let memo = "";

  const text = (row.customerMemo ?? "").trim();

  // 1. Detect channel prefix [채널]
  const channelMatch = text.match(/^\[([^\]]+)\]/);
  if (channelMatch) {
    channel = channelMatch[1].trim();
  } else if (row.note) {
    const noteMatch = row.note.match(/예약경로:\s*([^\s(]+)/);
    if (noteMatch) {
      channel = noteMatch[1].trim();
    }
  }

  // 2. Parse remainder
  let remainder = channelMatch ? text.slice(channelMatch[0].length).trim() : text;

  // Split memo if separated by '/'
  if (remainder.includes("/")) {
    const parts = remainder.split("/");
    remainder = parts[0].trim();
    memo = parts.slice(1).join("/").trim();
  }

  // Split contact if separated by '|'
  if (remainder.includes("|")) {
    const [n, c] = remainder.split("|").map((s) => s.trim());
    name = n || "-";
    contact = c || "-";
  } else {
    // Check if phone or ID is attached: "홍길동 010-1234-5678" or "홍길동 @hong123"
    const phoneOrIdMatch = remainder.match(/^(.+?)\s+(@[\w\d_.-]+|\d{2,4}-?\d{3,4}-?\d{4})$/);
    if (phoneOrIdMatch) {
      name = phoneOrIdMatch[1].trim();
      contact = phoneOrIdMatch[2].trim();
    } else {
      name = remainder || "-";
    }
  }

  // 3. Check customer reference
  const linked = customers?.find((c) => c.id === row.customerId) ?? row.customer;
  if (linked) {
    if ((name === "-" || !name) && linked.name) name = linked.name;
    if ((contact === "-" || !contact) && linked.phone) contact = linked.phone;
  }

  if (channel === "기타") {
    if (contact && contact !== "-" && /^[\d-+() ]+$/.test(contact)) {
      channel = "전화";
    }
  }

  return { channel, name, contact, memo };
}
