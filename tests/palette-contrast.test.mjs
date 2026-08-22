import assert from "node:assert/strict";
import test from "node:test";

test("core palette combinations meet WCAG AA contrast", () => {
  const relativeLuminance = (hex) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const ratio = (foreground, background) => {
    const values = [
      relativeLuminance(foreground),
      relativeLuminance(background),
    ].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };

  assert.ok(ratio("#111417", "#F6B500") >= 4.5);
  assert.ok(ratio("#F3F5F6", "#090C0F") >= 4.5);
  assert.ok(ratio("#AEB7BC", "#0E1215") >= 4.5);
  assert.ok(ratio("#929DA3", "#0B0F12") >= 4.5);
  assert.ok(ratio("#EF6D7D", "#0B0F12") >= 4.5);
  assert.ok(ratio("#F3F5F6", "#10161A") >= 4.5);
  // Currency/unit metadata beside every displayed price (rebar.css,
  // market-prices.css) — previously #8a8b94-family greys at ~3.3:1.
  assert.ok(ratio("#6B6C76", "#FFFFFF") >= 4.5);
});
