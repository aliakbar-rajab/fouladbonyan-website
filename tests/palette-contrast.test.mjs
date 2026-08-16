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

  assert.ok(ratio("#222226", "#F6B500") >= 4.5);
  assert.ok(ratio("#FFFFFF", "#3B3B3E") >= 4.5);
  assert.ok(ratio("#65656C", "#FFFFFF") >= 4.5);
});
