let nextId = 1

export function nanoid() {
  return `b_${Date.now().toString(36)}_${nextId++}`
}
