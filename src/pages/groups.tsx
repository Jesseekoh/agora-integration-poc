import { AppShell } from '../components/app-shell';
import { UsersIcon } from '../components/icons';

export type GroupRow = {
  id: string;
  name: string;
  memberCount: number;
};

type Props = {
  user: { id: string; name: string; email: string };
  mine: GroupRow[];
  others: GroupRow[];
};

const members = (n: number) => `${n} ${n === 1 ? 'member' : 'members'}`;

const GroupItem = ({ group, action }: { group: GroupRow; action: 'join' | 'leave' }) => (
  <li class="list-row items-center">
    <div class="flex size-10 items-center justify-center rounded-box bg-primary/10 font-semibold text-primary">
      {group.name[0]!.toUpperCase()}
    </div>
    <div>
      <div class="font-medium">{group.name}</div>
      <div class="text-xs text-base-content/60">{members(group.memberCount)}</div>
    </div>
    <form method="post" action={`/api/groups/${group.id}/${action}`}>
      {action === 'join' ? (
        <button type="submit" class="btn btn-primary btn-sm">
          Join
        </button>
      ) : (
        <button type="submit" class="btn btn-ghost btn-sm text-error">
          Leave
        </button>
      )}
    </form>
  </li>
);

export const GroupsPage = ({ user, mine, others }: Props) => (
  <AppShell user={user} active="groups">
    <h1 class="text-3xl font-semibold tracking-tight">Groups</h1>
    <p class="mt-1 text-base-content/60">Join groups to find people to call.</p>

    <section class="card mt-8 border border-base-300 bg-base-100">
      <div class="card-body">
        <h2 class="card-title text-base">Your groups</h2>
        {mine.length > 0 ? (
          <ul class="list -mx-4">
            {mine.map((group) => (
              <GroupItem group={group} action="leave" />
            ))}
          </ul>
        ) : (
          <div class="flex flex-col items-center gap-2 py-8 text-center">
            <UsersIcon class="size-8 opacity-40" />
            <p class="text-sm text-base-content/60">
              You're not in any groups yet. Join one below.
            </p>
          </div>
        )}
      </div>
    </section>

    <section class="card mt-6 border border-base-300 bg-base-100">
      <div class="card-body">
        <h2 class="card-title text-base">Other groups</h2>
        {others.length > 0 ? (
          <ul class="list -mx-4">
            {others.map((group) => (
              <GroupItem group={group} action="join" />
            ))}
          </ul>
        ) : (
          <p class="py-4 text-sm text-base-content/60">You've joined every group.</p>
        )}
      </div>
    </section>
  </AppShell>
);
