import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ID_FILE = join(process.cwd(), '.gamenest-node-id');

/**
 * A stable id for this node, generated once and persisted to a local file so
 * it survives restarts. Overridden by the NODE_ID env var if you'd rather
 * assign it explicitly (e.g. once the dashboard issues ids on registration).
 */
export function getOrCreateNodeId(): string {
  if (existsSync(ID_FILE)) {
    return readFileSync(ID_FILE, 'utf-8').trim();
  }
  const id = randomUUID();
  writeFileSync(ID_FILE, id, 'utf-8');
  return id;
}
