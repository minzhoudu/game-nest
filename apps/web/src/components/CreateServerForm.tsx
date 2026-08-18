import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { EnvVarSchema } from '@gamenest/shared-types';
import { api } from '../api/client';
import { useNodes } from '../hooks/useNodes';

function defaultsFor(envSchema: EnvVarSchema[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const field of envSchema) {
    if (field.default !== undefined) env[field.key] = String(field.default);
  }
  return env;
}

export function CreateServerForm({ onDone }: { onDone: () => void }) {
  const { data: nodes } = useNodes();
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: api.listTemplates });
  const queryClient = useQueryClient();

  const [nodeId, setNodeId] = useState('');
  const [templateSlug, setTemplateSlug] = useState('');
  const [name, setName] = useState('');
  const [env, setEnv] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const template = templates?.find((t) => t.slug === templateSlug);

  // Pre-select the first node/template once they've loaded, and reset env
  // overrides to the new template's defaults whenever the template changes.
  useEffect(() => {
    if (!nodeId && nodes && nodes.length > 0) setNodeId(nodes[0].nodeId);
  }, [nodes, nodeId]);
  useEffect(() => {
    if (!templateSlug && templates && templates.length > 0) setTemplateSlug(templates[0].slug);
  }, [templates, templateSlug]);
  useEffect(() => {
    if (template) setEnv(defaultsFor(template.envSchema));
  }, [template]);

  const createMutation = useMutation({
    mutationFn: () => api.createServer({ nodeId, templateSlug, name, env }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['servers'] });
      onDone();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
  });

  const canSubmit = nodeId && templateSlug && name.trim().length > 0 && !createMutation.isPending;

  return (
    <form
      className="create-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        createMutation.mutate();
      }}
    >
      <div className="field">
        <label htmlFor="server-name">Server name</label>
        <input
          id="server-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friends Server"
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="node-select">Node</label>
          <select id="node-select" value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!nodes?.length}>
            {nodes?.map((node) => (
              <option key={node.nodeId} value={node.nodeId}>
                {node.hostInfo.os.split(' ')[0]} ({node.nodeId.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="template-select">Game</label>
          <select id="template-select" value={templateSlug} onChange={(e) => setTemplateSlug(e.target.value)}>
            {templates?.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {template && template.envSchema.length > 0 && (
        <details className="advanced">
          <summary>Advanced options</summary>
          <div className="field-grid">
            {template.envSchema.map((field) =>
              field.type === 'boolean' ? (
                <label className="field-checkbox" key={field.key}>
                  <input
                    type="checkbox"
                    checked={env[field.key] === 'true'}
                    onChange={(e) => setEnv((prev) => ({ ...prev, [field.key]: String(e.target.checked) }))}
                  />
                  {field.label}
                </label>
              ) : (
                <div className="field" key={field.key}>
                  <label htmlFor={`env-${field.key}`}>{field.label}</label>
                  <input
                    id={`env-${field.key}`}
                    value={env[field.key] ?? ''}
                    onChange={(e) => setEnv((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ),
            )}
          </div>
        </details>
      )}

      {error && <p className="error">{error}</p>}
      {!nodes?.length && <p className="muted">No nodes connected — start an agent before creating a server.</p>}

      <div className="create-form-actions">
        <button type="button" className="ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" disabled={!canSubmit}>
          {createMutation.isPending ? 'Creating…' : 'Create & start'}
        </button>
      </div>
    </form>
  );
}
