import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListboxSelect } from "@/components/ui/listbox-select";

const options = [
  { value: "day_off", label: "보통 휴무" },
  { value: "special_day_off", label: "소중한날 휴가" }
];

describe("선택칸(공용 listbox)", () => {
  it("네이티브 select 대신 combobox 버튼을 그린다", () => {
    const html = renderToStaticMarkup(<ListboxSelect ariaLabel="휴가 종류" options={options} />);

    assert.doesNotMatch(html, /<select/);
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /aria-haspopup="listbox"/);
    assert.match(html, /aria-controls="[^"]+-listbox"/);
  });

  it("지금 고른 값을 글자로 보여주고 폼에는 숨은 input으로 보낸다", () => {
    const html = renderToStaticMarkup(<ListboxSelect defaultValue="special_day_off" name="kind" options={options} />);

    assert.match(html, /소중한날 휴가/);
    assert.match(html, /<input type="hidden" name="kind" value="special_day_off"\/>/);
  });

  it("제어하는 값이 목록에 없으면 자리표시 문구를 보여준다", () => {
    const html = renderToStaticMarkup(<ListboxSelect name="kind" options={options} placeholder="고르세요" value="없는 값" />);

    assert.match(html, /고르세요/);
    assert.match(html, /<input type="hidden" name="kind" value="없는 값"\/>/);
  });

  it("고른 값이 목록에 없으면 첫 항목을 고른다(네이티브 select와 같은 규칙)", () => {
    const html = renderToStaticMarkup(<ListboxSelect name="status" options={options} />);

    assert.match(html, />보통 휴무</);
    assert.match(html, /<input type="hidden" name="status" value="day_off"\/>/);
  });

  it("고른 값이 목록에 있으면 그 값을 고른다", () => {
    const html = renderToStaticMarkup(<ListboxSelect defaultValue="special_day_off" name="kind" options={options} />);

    assert.match(html, />소중한날 휴가</);
    assert.match(html, /<input type="hidden" name="kind" value="special_day_off"\/>/);
  });

  it("오류 칸은 aria-invalid로 알린다", () => {
    assert.match(
      renderToStaticMarkup(<ListboxSelect invalid options={options} />),
      /aria-invalid="true"/
    );
    assert.doesNotMatch(renderToStaticMarkup(<ListboxSelect options={options} />), /aria-invalid/);
  });

  it("도구줄 캡슐 모양도 같은 combobox로 그린다", () => {
    const html = renderToStaticMarkup(<ListboxSelect className="min-w-44" options={options} variant="capsule" />);

    assert.match(html, /rounded-full/);
    assert.match(html, /role="combobox"/);
  });
});
