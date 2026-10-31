import { AppShell, initials } from '../components/app-shell';
import { PhoneIcon, VideoIcon } from '../components/icons';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  online: boolean;
};

type Props = {
  user: { id: string; name: string; email: string };
  users: UserRow[];
};

export const UsersPage = ({ user, users }: Props) => (
  <AppShell user={user} active="users">
    <h1 class="text-3xl font-semibold tracking-tight">Users</h1>
    <p class="mt-1 text-base-content/60">Everyone with an account. Pick someone to call.</p>

    <section class="card mt-8 border border-base-300 bg-base-100">
      <div class="card-body">
        <ul class="list -mx-4">
          {users.map((u) => (
            <li class="list-row items-center">
              {/* src/client/calls.ts flips the dot when a presence event arrives */}
              <div
                class={`avatar avatar-placeholder ${u.online ? 'avatar-online' : 'avatar-offline'}`}
                data-presence-id={u.id}
                title={u.online ? 'Online' : 'Offline'}
              >
                <div class="w-10 rounded-full bg-primary/10 text-primary">
                  <span class="text-sm font-medium">{initials(u.name)}</span>
                </div>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 font-medium">
                  <span class="truncate">{u.name}</span>
                  {u.id === user.id && <span class="badge badge-ghost badge-sm">You</span>}
                </div>
                <div class="truncate text-xs text-base-content/60">{u.email}</div>
              </div>
              {u.id !== user.id && (
                // The call script (src/client/calls.ts) handles clicks on [data-callee-id]
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn btn-primary btn-soft btn-sm"
                    data-callee-id={u.id}
                    data-callee-name={u.name}
                    data-media="audio"
                    aria-label={`Voice call ${u.name}`}
                  >
                    <PhoneIcon />
                    <span class="hidden sm:inline">Call</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-callee-id={u.id}
                    data-callee-name={u.name}
                    data-media="video"
                    aria-label={`Video call ${u.name}`}
                  >
                    <VideoIcon />
                    <span class="hidden sm:inline">Video</span>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  </AppShell>
);
