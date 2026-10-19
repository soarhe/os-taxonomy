export function prerequisiteOrder(topics, dependencies, target, includeSoft = false) {
  const ids = new Set(topics.map(t => t.id));
  if (!ids.has(target)) throw new Error(`Unknown topic: ${target}`);
  const adjacent = new Map([...ids].map(id => [id, []]));
  for (const d of dependencies) {
    if (!ids.has(d.topicId) || !ids.has(d.prerequisiteId)) throw new Error('Unknown edge endpoint');
    if (includeSoft || d.strength === 'hard') adjacent.get(d.topicId).push(d.prerequisiteId);
  }
  const active = new Set(), done = new Set(), order = [];
  function visit(id) {
    if (active.has(id)) throw new Error(`Cycle at ${id}`);
    if (done.has(id)) return;
    active.add(id);
    for (const p of adjacent.get(id).sort()) visit(p);
    active.delete(id); done.add(id);
    if (id !== target) order.push(id);
  }
  visit(target);
  return order;
}

export function graphErrors(topics, dependencies) {
  const errors = [], ids = new Set(topics.map(t => t.id));
  const edges = new Set(), children = new Map([...ids].map(id => [id, []]));
  const degree = new Map([...ids].map(id => [id, 0]));
  for (const d of dependencies) {
    if (!ids.has(d.topicId) || !ids.has(d.prerequisiteId)) {
      errors.push(`Unknown edge endpoint: ${d.topicId} <- ${d.prerequisiteId}`); continue;
    }
    const key = `${d.topicId}:${d.prerequisiteId}`;
    if (edges.has(key)) errors.push(`Duplicate edge: ${key}`);
    edges.add(key);
    if (d.topicId === d.prerequisiteId) errors.push(`Self dependency: ${d.topicId}`);
    children.get(d.prerequisiteId).push(d.topicId);
    degree.set(d.topicId, degree.get(d.topicId) + 1);
  }
  const queue = [...ids].filter(id => degree.get(id) === 0);
  let visited = 0;
  for (let i=0; i<queue.length; i++) {
    const id = queue[i]; visited++;
    for (const next of children.get(id)) {
      degree.set(next, degree.get(next)-1);
      if (degree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== ids.size) errors.push(`Cycle detected: ${ids.size-visited} nodes remain after topological sort`);
  return errors;
}
