import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EnvVarSchema } from '@gamenest/shared-types';
import { api } from '../api/client';
import { EnvVarField } from '../components/EnvVarField';
import { useNodes } from '../hooks/useNodes';
import { useTemplates } from '../hooks/useTemplates';

function defaultsFor(envSchema: EnvVarSchema[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const field of envSchema) {
    if (field.default === undefined) continue;
    // range fields store a plain number (e.g. 2, "2 GB") — the actual env
    // value needs the unit appended, matching resolve-env.ts server-side.
    env[field.key] = field.type === 'range' && field.unit ? `${field.default}${field.unit}` : String(field.default);
  }
  return env;
}

export function CreateServerPage() {
  const navigate = useNavigate();
  const { data: nodes } = useNodes();
  const { data: templates } = useTemplates();
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
    onSuccess: (server) => {
      void queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate(`/servers/${server.id}`);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
  });

  const canSubmit = nodeId && templateSlug && name.trim().length > 0 && !createMutation.isPending;

  return (
    <section>
      <div className="section-header">
        <h2>New server</h2>
      </div>

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
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="node-select">Node</label>
            <select
              id="node-select"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              disabled={!nodes?.length}
            >
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

        {template && template.envSchema.some((f) => !f.hidden) && (
          <details className="advanced">
            <summary>Advanced options</summary>
            <div className="field-grid">
              {template.envSchema
                .filter((field) => !field.hidden)
                .map((field) => (
                  <EnvVarField
                    key={field.key}
                    field={field}
                    value={env[field.key] ?? ''}
                    onChange={(value) => setEnv((prev) => ({ ...prev, [field.key]: value }))}
                  />
                ))}
            </div>
          </details>
        )}

        {error && <p className="error">{error}</p>}
        {!nodes?.length && <p className="muted">No nodes connected — start an agent before creating a server.</p>}

        <div className="create-form-actions">
          <button type="button" className="ghost" onClick={() => navigate('/')}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}>
            {createMutation.isPending ? 'Creating…' : 'Create & start'}
          </button>
        </div>
      </form>
    </section>
  );
}
