export type FlowNode = {
  id: string;
  label: string;
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};
