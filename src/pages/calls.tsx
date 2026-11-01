import { AppShell, initials } from '../components/app-shell';
import {
  PhoneIcon,
  PhoneIncomingIcon,
  PhoneMissedIcon,
  PhoneOutgoingIcon,
  UsersIcon,
  VideoIcon,
} from '../components/icons';
import type { CallHistoryRow, HistoryFilter } from '../lib/call-history';

type Props = {
  user: { id: string; name: string; email: string };
  calls: CallHistoryRow[];
  filter?: HistoryFilter;
};

const tabs: { label: string; filter?: HistoryFilter }[] = [
  { label: 'All' },
  { label: 'Missed', filter: 'missed' },
  { label: 'Placed', filter: 'placed' },
  { label: 'Answered', filter: 'answered' },
  { label: 'Declined', filter: 'declined' },
];

// How the call went for the viewer
const outcome = (call: CallHistoryRow) => {
  if (call.role === 'caller')
    return { label: 'Outgoing', Icon: PhoneOutgoingIcon, tone: 'text-base-content/60' };
  switch (call.outcome) {
    case 'joined':
      return { label: 'Answered', Icon: PhoneIncomingIcon, tone: 'text-success' };
    case 'declined':
      return { label: 'Declined', Icon: PhoneIncomingIcon, tone: 'text-base-content/60' };
    case 'missed':
      return { label: 'Missed', Icon: PhoneMissedIcon, tone: 'text-error' };
    default:
      return { label: 'Ringing', Icon: PhoneIncomingIcon, tone: 'text-info' };
  }
};

// Who the call was with: the group, or the other person in a 1:1 call
const counterpart = (call: CallHistoryRow, meId: string) => {
  if (call.group) return { name: call.group.name, isGroup: true };
  const other = call.caller.id === meId ? call.callee : call.caller;
  return { name: other?.name ?? 'Deleted user', isGroup: false };
};

// UTC fallback; the inline script below swaps in the viewer's local time
const utc = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

const CallBackButton = ({ call, meId }: { call: CallHistoryRow; meId: string }) => {
  const Media = call.media === 'video' ? VideoIcon : PhoneIcon;
  const kind = call.media === 'video' ? 'Video call' : 'Call';
  // The call script (src/client/calls.ts) handles clicks on [data-callee-id] and [data-group-id]
  if (call.group) {
    return (
      <button
        type="button"
        class="btn btn-primary btn-soft btn-sm"
        data-group-id={call.group.id}
        data-group-name={call.group.name}
        data-media={call.media}
        aria-label={`${kind} ${call.group.name}`}
      >
        <Media />
        <span class="hidden sm:inline">Call back</span>
      </button>
    );
  }
  const other = call.caller.id === meId ? call.callee : call.caller;
  if (!other) return null;
  return (
    <button
      type="button"
      class="btn btn-primary btn-soft btn-sm"
      data-callee-id={other.id}
      data-callee-name={other.name}
      data-media={call.media}
      aria-label={`${kind} ${other.name}`}
    >
      <Media />
      <span class="hidden sm:inline">Call back</span>
    </button>
  );
};

export const CallsPage = ({ user, calls, filter }: Props) => (
  <AppShell user={user} active="calls">
    <h1 class="text-3xl font-semibold tracking-tight">Calls</h1>
    <p class="mt-1 text-base-content/60">Calls you've placed, answered, declined and missed.</p>

    <nav role="tablist" class="tabs tabs-box mt-8 w-fit max-w-full overflow-x-auto">
      {tabs.map((t) => (
        <a
          role="tab"
          href={t.filter ? `/calls?filter=${t.filter}` : '/calls'}
          class={`tab ${t.filter === filter ? 'tab-active' : ''}`}
          aria-selected={t.filter === filter}
        >
          {t.label}
        </a>
      ))}
    </nav>

    <section class="card mt-4 border border-base-300 bg-base-100">
      <div class="card-body">
        {calls.length === 0 ? (
          <p class="py-8 text-center text-base-content/60">
            {filter ? `No ${filter} calls yet.` : 'No calls yet. Start one from the Users or Groups page.'}
          </p>
        ) : (
          <ul class="list -mx-4">
            {calls.map((call) => {
              const { label, Icon, tone } = outcome(call);
              const who = counterpart(call, user.id);
              return (
                <li class="list-row items-center">
                  <div class="avatar avatar-placeholder">
                    <div class="w-10 rounded-full bg-primary/10 text-primary">
                      {who.isGroup ? (
                        <UsersIcon />
                      ) : (
                        <span class="text-sm font-medium">{initials(who.name)}</span>
                      )}
                    </div>
                  </div>
                  <div class="min-w-0">
                    <div class="truncate font-medium">{who.name}</div>
                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-base-content/60">
                      <span class={`flex items-center gap-1 ${tone}`}>
                        <Icon class="size-3.5" />
                        {label}
                      </span>
                      <span>·</span>
                      <span>{call.media === 'video' ? 'Video' : 'Voice'}</span>
                      {who.isGroup && call.caller.id !== user.id && (
                        <>
                          <span>·</span>
                          <span class="truncate">from {call.caller.name}</span>
                        </>
                      )}
                      <span>·</span>
                      <time datetime={call.createdAt} data-local>
                        {utc(call.createdAt)}
                      </time>
                    </div>
                  </div>
                  <CallBackButton call={call} meId={user.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>

    <script
      dangerouslySetInnerHTML={{
        __html: `for (const el of document.querySelectorAll('time[data-local]')) el.textContent = new Date(el.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });`,
      }}
    />
  </AppShell>
);
