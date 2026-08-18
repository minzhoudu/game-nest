import { ServerStatus } from '@gamenest/shared-types';

const LABELS: Record<ServerStatus, string> = {
  [ServerStatus.CREATING]: 'Creating',
  [ServerStatus.STOPPED]: 'Stopped',
  [ServerStatus.STARTING]: 'Starting',
  [ServerStatus.RUNNING]: 'Running',
  [ServerStatus.STOPPING]: 'Stopping',
  [ServerStatus.ERROR]: 'Error',
  [ServerStatus.DELETING]: 'Deleting',
};

// CSS class suffix — see .badge-* rules in App.css.
const TONES: Record<ServerStatus, string> = {
  [ServerStatus.CREATING]: 'busy',
  [ServerStatus.STOPPED]: 'idle',
  [ServerStatus.STARTING]: 'busy',
  [ServerStatus.RUNNING]: 'up',
  [ServerStatus.STOPPING]: 'busy',
  [ServerStatus.ERROR]: 'error',
  [ServerStatus.DELETING]: 'busy',
};

export function StatusBadge({ status }: { status: ServerStatus }) {
  return <span className={`badge badge-${TONES[status]}`}>{LABELS[status]}</span>;
}
