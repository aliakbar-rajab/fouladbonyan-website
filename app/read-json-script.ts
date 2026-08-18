export function readJsonScript(id: string) {
  const element = document.getElementById(id);
  if (!element?.textContent) return null;
  try {
    return JSON.parse(element.textContent);
  } catch {
    return null;
  }
}
