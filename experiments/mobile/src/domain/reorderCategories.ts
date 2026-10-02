export function reorderCategories(categories: readonly string[], category: string, target: string): string[] {
  const from = categories.indexOf(category)
  const to = categories.indexOf(target)
  if (from < 0 || to < 0 || from === to) return [...categories]
  const next = [...categories]
  next.splice(from, 1)
  next.splice(to, 0, category)
  return next
}
