import { AppShell } from '../components/app-shell';
import { PhoneIcon } from '../components/icons';

type Props = {
  user: { id: string; name: string; email: string };
};

export const HomePage = ({ user }: Props) => (
  <AppShell user={user} active="home">
    <h1 class="text-3xl font-semibold tracking-tight">Hello, {user.name.split(' ')[0]}</h1>
    <p class="mt-1 text-base-content/60">Ready when you are.</p>

    <section class="card mt-8 border border-base-300 bg-base-100">
      <div class="card-body items-center py-16 text-center">
        <div class="flex size-14 items-center justify-center rounded-full bg-base-200">
          <PhoneIcon class="size-6 opacity-60" />
        </div>
        <h2 class="card-title mt-2">No calls yet</h2>
        <p class="max-w-xs text-sm text-base-content/60">
          Calls you make or receive will show up here.
        </p>
      </div>
    </section>
  </AppShell>
);
