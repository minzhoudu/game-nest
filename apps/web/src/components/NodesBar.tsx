import { useNodes } from '../hooks/useNodes';

export function NodesBar() {
  const { data: nodes, isLoading } = useNodes();

  if (isLoading) return null;

  if (!nodes || nodes.length === 0) {
    return (
      <div className="nodes-bar nodes-bar-empty">
        No nodes connected. Start an agent (<code>pnpm --filter @gamenest/agent dev</code>) to spin up servers.
      </div>
    );
  }

  return (
    <div className="nodes-bar">
      {nodes.map((node) => (
        <div className="node-chip" key={node.nodeId} title={`Node ${node.nodeId}`}>
          <span className="dot dot-up" />
          {node.hostInfo.os.split(' ')[0]} · {node.hostInfo.cpuCount} cpu · docker {node.hostInfo.dockerVersion}
        </div>
      ))}
    </div>
  );
}
