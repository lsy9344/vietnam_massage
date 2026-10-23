import type { CustomerDto } from "@/modules/calls/service-call-service";

export type BookingChannelType =
  | "텔레그램"
  | "카카오톡"
  | "잘로"
  | "왓츠앱"
  | "위챗"
  | "워크인"
  | "기타"
  | "전화";

export const BOOKING_CHANNELS = [
  { id: "텔레그램", label: "텔레그램", color: "#0186FF" },
  { id: "카카오톡", label: "카카오톡", color: "#FFCC02" },
  { id: "잘로", label: "잘로", color: "#005AFE" },
  { id: "왓츠앱", label: "왓츠앱", color: "#12B759" },
  { id: "위챗", label: "위챗", color: "#039201" },
  { id: "워크인", label: "워크인", color: "#FE6E05" },
  { id: "기타", label: "기타", color: "#707882" }
] as const;

export const ALL_BOOKING_PATHS = [
  { id: "전화", label: "전화", color: "#0066FF" },
  ...BOOKING_CHANNELS
] as const;

export function TelegramChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="텔레그램"
    >
      <title>텔레그램</title>
      <circle cx="12" cy="12" r="12" fill="#0186FF" />
      <path
        d="M16.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .36z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function KakaoTalkChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="카카오톡"
    >
      <title>카카오톡</title>
      <circle cx="12" cy="12" r="12" fill="#FFCC02" />
      <path
        d="M12 5.5c-3.65 0-6.6 2.34-6.6 5.23 0 1.88 1.25 3.53 3.14 4.45l-.8 2.95c-.07.26.22.47.44.33l3.53-2.33c.42.06.85.09 1.29.09 3.65 0 6.6-2.34 6.6-5.23S15.65 5.5 12 5.5z"
        fill="#3C1E1E"
      />
      <text
        x="12"
        y="11.8"
        textAnchor="middle"
        fill="#FFCC02"
        fontSize="3.5"
        fontWeight="900"
        fontFamily="sans-serif"
        letterSpacing="-0.2"
      >
        TALK
      </text>
    </svg>
  );
}

export function ZaloChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="잘로"
    >
      <title>잘로</title>
      <circle cx="12" cy="12" r="12" fill="#005AFE" />
      <text
        x="12"
        y="13.8"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="7.2"
        fontWeight="900"
        fontFamily="sans-serif"
        letterSpacing="-0.3"
      >
        Zalo
      </text>
    </svg>
  );
}

export function WhatsAppChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="왓츠앱"
    >
      <title>왓츠앱</title>
      <circle cx="12" cy="12" r="12" fill="#12B759" />
      <path
        d="M12.04 4.5c-4.14 0-7.51 3.37-7.51 7.51 0 1.33.35 2.62 1 3.75l-1.05 3.84 3.98-1.05c1.1.6 2.33.92 3.58.92 4.14 0 7.51-3.37 7.51-7.51 0-2.01-.78-3.9-2.2-5.31A7.44 7.44 0 0012.04 4.5zm4.39 10.66c-.18.52-1.06.95-1.46 1.01-.38.05-.87.08-2.52-.59-2.02-.83-3.33-2.87-3.43-3.01-.1-.14-.81-1.08-.81-2.07 0-.98.52-1.47.7-1.67.18-.2.4-.25.54-.25.14 0 .27 0 .39.01.13.01.3-.05.46.36.17.42.59 1.45.64 1.55.05.11.09.23.02.36-.08.14-.11.23-.23.36-.11.14-.24.3-.35.41-.11.11-.23.24-.1.48.14.23.6 1 1.29 1.6 1.05.94 1.63 1.03 1.86 1.14.23.11.37.1.51-.06.14-.16.59-.69.75-.92.16-.23.32-.2.54-.11.22.08 1.39.66 1.63.78.24.12.4.18.46.28.06.1.06.58-.12 1.1z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function WeChatChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="위챗"
    >
      <title>위챗</title>
      <circle cx="12" cy="12" r="12" fill="#039201" />
      <path
        d="M8.5 6.5C5.46 6.5 3 8.64 3 11.28c0 1.45.74 2.75 1.91 3.63l-.48 1.8a.37.37 0 00.54.4l2.09-1.04c.46.13.96.19 1.44.19.18 0 .37-.01.55-.04-.35-.69-.55-1.47-.55-2.3 0-2.97 2.74-5.38 6.14-5.38.16 0 .32.01.48.02C14.12 7.26 11.49 6.5 8.5 6.5zm-1.65 2.94a.74.74 0 110 1.47.74.74 0 010-1.47zm3.3 0a.74.74 0 110 1.47.74.74 0 010-1.47zm4.23 2.39c-2.64 0-4.78 1.89-4.78 4.23 0 1.28.64 2.43 1.65 3.2l-.42 1.58a.3.3 0 00.43.32l1.83-.91c.41.12.85.18 1.29.18 2.64 0 4.78-1.89 4.78-4.23s-2.14-4.37-4.78-4.37zm-1.47 2.57a.63.63 0 110 1.25.63.63 0 010-1.25zm2.94 0a.63.63 0 110 1.25.63.63 0 010-1.25z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function WalkinChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="워크인"
    >
      <title>워크인</title>
      <circle cx="12" cy="12" r="12" fill="#FE6E05" />
      <circle cx="12.5" cy="6" r="1.8" fill="#FFFFFF" />
      <path
        d="M10.8 9.2l-2.2 1.3.7 1.4 1.5-.9v2.8l2 5.5h1.8l-1.8-5.1 1.6-1.3 2.2 3.3h1.8l-2.7-4 .3-2.2c.7.7 1.6 1.1 2.4 1.1v-1.8c-.8 0-1.6-.4-2.2-1.1l-1.2-1.4c-.4-.4-.9-.7-1.4-.7-.3 0-.5.1-.8.2L10.8 9.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function EtcChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="기타"
    >
      <title>기타</title>
      <circle cx="12" cy="12" r="12" fill="#707882" />
      <text
        x="12"
        y="14.2"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="7.5"
        fontWeight="800"
        fontFamily="sans-serif"
        letterSpacing="-0.4"
      >
        etc
      </text>
    </svg>
  );
}

export function PhoneChannelIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 rounded-full shadow-2xs ${className}`}
      fill="none"
      role="img"
      aria-label="전화"
    >
      <title>전화</title>
      <circle cx="12" cy="12" r="12" fill="#0066FF" />
      <path
        d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.74 21 3 13.26 3 3.99a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.21 2.21z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function BookingChannelIcon({
  channel,
  className = "w-7 h-7"
}: {
  channel: string;
  className?: string;
}) {
  const norm = (channel || "").trim().toLowerCase();

  if (norm.includes("텔레") || norm.includes("tele") || /\btg\b/.test(norm)) {
    return <TelegramChannelIcon className={className} />;
  }

  if (norm.includes("카카오") || norm.includes("kakao") || norm.includes("카톡") || norm.includes("ktalk")) {
    return <KakaoTalkChannelIcon className={className} />;
  }

  if (norm.includes("잘로") || norm.includes("zalo")) {
    return <ZaloChannelIcon className={className} />;
  }

  if (norm.includes("왓츠") || norm.includes("whats") || norm.includes("whatsapp") || /\bwa\b/.test(norm)) {
    return <WhatsAppChannelIcon className={className} />;
  }

  if (
    norm.includes("위챗") ||
    norm.includes("위쳇") ||
    norm.includes("웨이신") ||
    norm.includes("wechat") ||
    norm.includes("weixin") ||
    norm.includes("微信") ||
    /\bwx\b/.test(norm)
  ) {
    return <WeChatChannelIcon className={className} />;
  }

  if (
    norm.includes("워크") ||
    norm.includes("walk") ||
    norm.includes("현장") ||
    norm.includes("직접") ||
    norm.includes("로드")
  ) {
    return <WalkinChannelIcon className={className} />;
  }

  if (
    norm.includes("전화") ||
    norm.includes("phone") ||
    norm.includes("call") ||
    norm.includes("유선") ||
    norm.includes("통화")
  ) {
    return <PhoneChannelIcon className={className} />;
  }

  return <EtcChannelIcon className={className} />;
}

export function detectChannelKeyword(text: string): BookingChannelType | null {
  const norm = text.toLowerCase();
  if (norm.includes("텔레") || norm.includes("tele") || /\btg\b/.test(norm)) return "텔레그램";
  if (norm.includes("카카오") || norm.includes("카톡") || norm.includes("kakao") || norm.includes("ktalk")) return "카카오톡";
  if (norm.includes("잘로") || norm.includes("zalo")) return "잘로";
  if (norm.includes("왓츠") || norm.includes("whatsapp") || /\bwhats\b/.test(norm) || /\bwa\b/.test(norm)) return "왓츠앱";
  if (
    norm.includes("위챗") ||
    norm.includes("위쳇") ||
    norm.includes("웨이신") ||
    norm.includes("wechat") ||
    norm.includes("weixin") ||
    norm.includes("微信") ||
    /\bwx\b/.test(norm)
  ) {
    return "위챗";
  }
  if (
    norm.includes("워크") ||
    norm.includes("walk") ||
    norm.includes("현장") ||
    norm.includes("직접") ||
    norm.includes("로드")
  ) {
    return "워크인";
  }
  if (
    norm.includes("전화") ||
    norm.includes("유선") ||
    norm.includes("통화") ||
    norm.includes("phone") ||
    norm.includes("call") ||
    norm.includes("tel")
  ) {
    return "전화";
  }
  if (norm.includes("기타") || /\betc\b/.test(norm)) return "기타";
  return null;
}

export function cleanChannelPrefix(name: string): string {
  let cleaned = name.trim();
  cleaned = cleaned.replace(/^\[[^\]]+\]\s*/, "").replace(/^\([^\)]+\)\s*/, "");
  cleaned = cleaned.replace(
    /^(?:텔레그램|텔레|telegram|tele|카카오톡|카카오|카톡|kakao|잘로|zalo|왓츠앱|왓츠|whatsapp|위챗|위쳇|웨이신|wechat|워크인|현장|walk-in|walkin|전화|유선|기타)\s*[:·-]?\s*/i,
    ""
  );
  return cleaned.trim() || name;
}

export function parseCustomerCallInfo(
  row: {
    customerMemo?: string | null;
    note?: string | null;
    customerId?: string | null;
    customer?: { name: string; phone?: string | null } | null;
    bookingChannelCode?: string | null;
    bookerName?: string | null;
  },
  customers?: CustomerDto[]
) {
  let channel: BookingChannelType = "기타";
  let name = "-";
  let contact = "-";
  let memo = "";

  const text = (row.customerMemo ?? "").trim();
  const note = (row.note ?? "").trim();
  const booker = (row.bookerName ?? "").trim();
  const code = (row.bookingChannelCode ?? "").trim().toUpperCase();

  // 1. Direct match from bookingChannelCode
  if (code) {
    if (code === "TELEGRAM" || code.includes("TELE")) {
      channel = "텔레그램";
    } else if (code === "KAKAOTALK" || code === "KAKAO") {
      channel = "카카오톡";
    } else if (code === "ZALO") {
      channel = "잘로";
    } else if (code === "WHATSAPP" || code.includes("WHATS")) {
      channel = "왓츠앱";
    } else if (code === "WECHAT" || code.includes("WECHAT")) {
      channel = "위챗";
    } else if (code === "WALK_IN" || code === "WALKIN" || code.includes("WALK")) {
      channel = "워크인";
    } else if (code === "PHONE") {
      channel = "전화";
    } else if (code === "OTHER" || code === "ETC") {
      channel = "기타";
    }
  }

  // 2. Detect channel prefix [채널] in text or note
  const channelMatch = text.match(/^\[([^\]]+)\]/);
  if (channelMatch) {
    const detected = detectChannelKeyword(channelMatch[1].trim());
    if (detected) {
      channel = detected;
    }
  } else if (note) {
    const noteMatch = note.match(/예약경로:\s*([^\s(]+)/);
    if (noteMatch) {
      const detected = detectChannelKeyword(noteMatch[1].trim());
      if (detected) {
        channel = detected;
      }
    }
  }

  // 3. Remainder from text
  let remainder = channelMatch ? text.slice(channelMatch[0].length).trim() : text;

  // Split memo if separated by '/'
  if (remainder.includes("/")) {
    const parts = remainder.split("/");
    remainder = parts[0].trim();
    memo = parts.slice(1).join("/").trim();
  }

  // 4. Check for linked customer
  const linked = customers?.find((c) => c.id === row.customerId) ?? row.customer;
  const linkedName = linked?.name?.trim() || "";
  const linkedPhone = linked?.phone?.trim() || "";

  // If channel is still "기타", check keywords in remainder, note, booker, linkedName
  if (channel === "기타") {
    const combined = `${remainder} ${note} ${booker} ${linkedName}`;
    const detected = detectChannelKeyword(combined);
    if (detected) {
      channel = detected;
    }
  }

  // 5. Parse name and contact from remainder
  if (remainder.includes("|")) {
    const [n, c] = remainder.split("|").map((s) => s.trim());
    name = n || "-";
    contact = c || "-";
  } else if (remainder.includes("·")) {
    const [n, c] = remainder.split("·").map((s) => s.trim());
    name = n || "-";
    contact = c || "-";
  } else {
    // Check if phone or ID is attached: "홍길동 010-1234-5678" or "홍길동 @hong123" or "David +84-90-123-4567"
    const phoneOrIdMatch = remainder.match(/^(.+?)\s+(@[\w\d_.-]+|\+?\d{1,4}[- ]?\d{2,4}[- ]?\d{3,4}[- ]?\d{3,4})$/);
    if (phoneOrIdMatch) {
      name = phoneOrIdMatch[1].trim();
      contact = phoneOrIdMatch[2].trim();
    } else {
      name = remainder || "-";
    }
  }

  // Clean channel prefix from name if name starts with a keyword (e.g. "텔레 jo jo", "카톡 이몽룡")
  name = cleanChannelPrefix(name);

  // If name is empty or "-", fallback to linked customer name or bookerName
  if ((name === "-" || !name) && linkedName) {
    name = cleanChannelPrefix(linkedName);
  }
  if ((name === "-" || !name) && booker) {
    name = cleanChannelPrefix(booker);
  }

  // If contact is empty or "-", fallback to linked phone
  if ((contact === "-" || !contact) && linkedPhone) {
    contact = linkedPhone;
  }

  // 6. Contact-based channel inference
  if (channel === "기타") {
    if (contact && contact !== "-") {
      if (contact.startsWith("@")) {
        channel = "텔레그램";
      } else if (contact.startsWith("+84") || contact.startsWith("+")) {
        channel = "왓츠앱";
      } else if (/^[\d-+() ]+$/.test(contact)) {
        channel = "전화";
      }
    }
  }

  return { channel, name, contact, memo };
}
