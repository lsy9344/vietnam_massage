import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLockup, BrandMark } from "@/components/ui/brand-logo";

function images(html: string) {
  return [...html.matchAll(/<img [^>]*>/g)].map((match) => match[0]);
}

function alt(tag: string) {
  return tag.match(/ alt="([^"]*)"/)?.[1] ?? null;
}

describe("BrandLockup", () => {
  it("names the brand once for screen readers", () => {
    const tags = images(renderToStaticMarkup(<BrandLockup />));

    assert.ok(tags.length > 0);
    assert.ok(tags.every((tag) => alt(tag) !== null), "every image says whether it is decorative");
    assert.deepEqual(tags.map(alt).filter(Boolean), ["GANGNAM SPA"]);
  });

  it("sweeps light over the mark and then the name only when asked, hidden from screen readers", () => {
    const sheenLayers = (html: string) => [...html.matchAll(/<span [^>]*class="[^"]*brand-sheen[^"]*"[^>]*>/g)].map((match) => match[0]);

    assert.deepEqual(sheenLayers(renderToStaticMarkup(<BrandLockup />)), []);

    const sweeping = renderToStaticMarkup(<BrandLockup sheen />);
    const layers = sheenLayers(sweeping);
    assert.equal(layers.length, 2);
    assert.ok(layers.every((tag) => tag.includes('aria-hidden="true"')));
    assert.deepEqual(images(sweeping).map(alt).filter(Boolean), ["GANGNAM SPA"]);
  });
});

describe("BrandMark", () => {
  it("stays still and is decorative unless it is given the brand name, as on the TV board", () => {
    assert.deepEqual(images(renderToStaticMarkup(<BrandMark />)).map(alt), [""]);

    const labelled = renderToStaticMarkup(<BrandMark label="GANGNAM SPA" />);
    assert.deepEqual(images(labelled).map(alt), ["GANGNAM SPA"]);
    assert.doesNotMatch(labelled, /brand-sheen/);
  });
});
