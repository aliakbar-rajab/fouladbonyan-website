/**
 * Index an arrow/Home/End key should move focus to inside a tablist, or null
 * when the key is not a tablist key.
 *
 * ArrowLeft advances and ArrowRight retreats: the tabs are laid out
 * right-to-left, so "left" is forward on screen.
 */
export function nextRovingIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  if (!count) return null;
  if (key === "ArrowLeft") return (currentIndex + 1) % count;
  if (key === "ArrowRight") return (currentIndex - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
