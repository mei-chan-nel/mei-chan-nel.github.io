export function createNarrationHistory({ capture, restore }) {
  const pages = [];
  const previousIndex = (currentKey) =>
    pages.length - (currentKey === pages.at(-1)?.key ? 2 : 1);
  return {
    record(key) {
      if (key == null) return;
      const page = { key, saved: capture() };
      if (key === pages.at(-1)?.key) pages[pages.length - 1] = page;
      else pages.push(page);
    },
    canGoBack(currentKey) {
      return previousIndex(currentKey) >= 0;
    },
    back(currentKey) {
      const target = previousIndex(currentKey);
      if (target < 0) return false;
      const saved = pages[target].saved;
      // Later answers and protocol changes belong to the abandoned branch.
      pages.length = target + 1;
      restore(saved);
      return true;
    },
  };
}
