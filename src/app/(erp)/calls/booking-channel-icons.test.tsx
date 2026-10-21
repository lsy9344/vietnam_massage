import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BOOKING_CHANNELS,
  BookingChannelIcon,
  EtcChannelIcon,
  KakaoTalkChannelIcon,
  TelegramChannelIcon,
  WalkinChannelIcon,
  WeChatChannelIcon,
  WhatsAppChannelIcon,
  ZaloChannelIcon,
  parseCustomerCallInfo
} from "@/app/(erp)/calls/booking-channel-icons";

describe("BookingChannelIcon and customer info symbols", () => {
  it("exports exactly the 7 customer info booking channels in canonical order", () => {
    assert.deepEqual(
      BOOKING_CHANNELS.map((c) => c.id),
      ["텔레그램", "카카오톡", "잘로", "왓츠앱", "위챗", "워크인", "기타"]
    );
  });

  it("renders 텔레그램 icon with vibrant blue circle (#0186FF)", () => {
    const html = renderToStaticMarkup(<TelegramChannelIcon className="w-7 h-7" />);
    assert.match(html, /#0186FF/i);
    assert.match(html, /<title>텔레그램<\/title>/);
  });

  it("renders 카카오톡 icon with yellow circle (#FFCC02) and TALK speech bubble", () => {
    const html = renderToStaticMarkup(<KakaoTalkChannelIcon className="w-7 h-7" />);
    assert.match(html, /#FFCC02/i);
    assert.match(html, /TALK/);
    assert.match(html, /<title>카카오톡<\/title>/);
  });

  it("renders 잘로 icon with blue circle (#005AFE) and Zalo text", () => {
    const html = renderToStaticMarkup(<ZaloChannelIcon className="w-7 h-7" />);
    assert.match(html, /#005AFE/i);
    assert.match(html, /Zalo/);
    assert.match(html, /<title>잘로<\/title>/);
  });

  it("renders 왓츠앱 icon with green circle (#12B759)", () => {
    const html = renderToStaticMarkup(<WhatsAppChannelIcon className="w-7 h-7" />);
    assert.match(html, /#12B759/i);
    assert.match(html, /<title>왓츠앱<\/title>/);
  });

  it("renders 위챗 icon with green circle (#039201)", () => {
    const html = renderToStaticMarkup(<WeChatChannelIcon className="w-7 h-7" />);
    assert.match(html, /#039201/i);
    assert.match(html, /<title>위챗<\/title>/);
  });

  it("renders 워크인 icon with orange circle (#FE6E05) and person silhouette", () => {
    const html = renderToStaticMarkup(<WalkinChannelIcon className="w-7 h-7" />);
    assert.match(html, /#FE6E05/i);
    assert.match(html, /<title>워크인<\/title>/);
  });

  it("renders 기타 icon with gray circle (#707882) and etc text", () => {
    const html = renderToStaticMarkup(<EtcChannelIcon className="w-7 h-7" />);
    assert.match(html, /#707882/i);
    assert.match(html, /etc/);
    assert.match(html, /<title>기타<\/title>/);
  });

  it("BookingChannelIcon delegates properly to each of the 7 channel symbols", () => {
    for (const channel of ["텔레그램", "카카오톡", "잘로", "왓츠앱", "위챗", "워크인", "기타"] as const) {
      const html = renderToStaticMarkup(<BookingChannelIcon channel={channel} className="w-7 h-7" />);
      assert.match(html, new RegExp(`<title>${channel}</title>`));
    }
  });

  it("parseCustomerCallInfo parses [채널] name contact format accurately", () => {
    const row = {
      customerMemo: "[텔레그램] 홍길동 @hong123 / 조용한 방 선호",
      note: null,
      customerId: null,
      customer: null
    };
    const parsed = parseCustomerCallInfo(row);
    assert.equal(parsed.channel, "텔레그램");
    assert.equal(parsed.name, "홍길동");
    assert.equal(parsed.contact, "@hong123");
    assert.equal(parsed.memo, "조용한 방 선호");
  });
});
