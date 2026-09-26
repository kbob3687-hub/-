export type GraphNode = { id: string; theme: string | null; x: number; y: number; vx: number; vy: number; phase: number };
export type GraphEdge = { from: string; to: string; theme: string };
type NodeInput = Pick<GraphNode, "id" | "theme">;

export function createGraphNodes(items: NodeInput[], width: number, height: number): GraphNode[] {
  const themes = [...new Set(items.map(item => item.theme).filter(Boolean))];
  const counters = new Map<string | null, number>();
  return items.map((item, index) => {
    const group = item.theme ? themes.indexOf(item.theme) : 4;
    const ordinal = counters.get(item.theme) || 0;
    counters.set(item.theme, ordinal + 1);
    const angle = ordinal * 2.39996 + group * .8;
    const radius = 26 + Math.sqrt(ordinal + 1) * Math.min(width, height) * .065;
    const centerX = item.theme ? (group % 2 ? .7 : .3) : .5;
    const centerY = item.theme ? (group < 2 ? .30 : .62) : .5;
    return { ...item, x: width * centerX + Math.cos(angle) * radius, y: height * centerY + Math.sin(angle) * radius, vx: 0, vy: 0, phase: index * 1.71 };
  });
}

export function stepGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number, time: number, delta: number, held: Set<string>, encounter?: { root: string; neighbors: string[] } | null) {
  const forces = nodes.map(node => ({ x: Math.cos(time * .27 + node.phase) * 9 + (width / 2 - node.x) * .006, y: Math.sin(time * .23 + node.phase) * 7 + (height / 2 - node.y) * .006 }));
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const spacing = Math.max(50, Math.min(80, Math.sqrt(width * height / Math.max(nodes.length, 1)) * .8));
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
    if (Math.abs(dx) + Math.abs(dy) < .01) { dx = .1; dy = .1; }
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force = Math.min(100, 4800 / (distance * distance) + Math.max(0, spacing - distance) * 2);
    const fx = dx / distance * force, fy = dy / distance * force;
    forces[i].x -= fx; forces[i].y -= fy; forces[j].x += fx; forces[j].y += fy;
  }
  const restLength = Math.max(65, Math.min(135, Math.sqrt(width * height / Math.max(nodes.length, 1)) * 1.15));
  for (const edge of edges) {
    const a = indexById.get(edge.from), b = indexById.get(edge.to);
    if (a === undefined || b === undefined) continue;
    const dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y;
    const distance = Math.max(1, Math.hypot(dx, dy)), force = (distance - restLength) * .045;
    const fx = dx / distance * force, fy = dy / distance * force;
    forces[a].x += fx; forces[a].y += fy; forces[b].x -= fx; forces[b].y -= fy;
  }
  const friction = Math.pow(.96, delta * 60);
  const root = nodes.find(node => node.id === encounter?.root);
  if (root && encounter) encounter.neighbors.forEach((id, index) => {
    const nodeIndex = indexById.get(id);
    if (nodeIndex === undefined) return;
    const angle = index * Math.PI * 2 / encounter.neighbors.length - Math.PI / 2;
    const radius = Math.max(75, Math.min(155, width * .2));
    forces[nodeIndex].x += (root.x + Math.cos(angle) * radius - nodes[nodeIndex].x) * .8;
    forces[nodeIndex].y += (root.y + Math.sin(angle) * radius - nodes[nodeIndex].y) * .8;
  });
  nodes.forEach((node, index) => {
    if (held.has(node.id)) { node.vx = 0; node.vy = 0; return; }
    node.vx = Math.max(-24, Math.min(24, (node.vx + forces[index].x * delta) * friction));
    node.vy = Math.max(-24, Math.min(24, (node.vy + forces[index].y * delta) * friction));
    node.x = Math.max(34, Math.min(width - 34, node.x + node.vx * delta));
    node.y = Math.max(54, Math.min(height - 110, node.y + node.vy * delta));
  });
}
