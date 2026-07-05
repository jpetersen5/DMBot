export function getStoredTheme(): string {
  return localStorage.getItem("theme") || "light";
}

export function applyTheme(theme: string): void {
  localStorage.setItem("theme", theme);
  document.documentElement.className = "";
  document.documentElement.classList.add(`theme-${theme}`);
}
