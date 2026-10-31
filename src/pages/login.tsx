import { AuthShell } from '../components/auth-shell';
import { LockIcon, MailIcon } from '../components/icons';

type Props = {
  error?: string;
  email?: string;
  next?: string;
};

export const LoginPage = ({ error, email, next }: Props) => {
  const action = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <AuthShell
      heading="Welcome back"
      subheading="Log in to start or join a call"
      error={error}
      footer={
        <>
          No account?{' '}
          <a href="/signup" class="link link-primary font-medium">
            Sign up
          </a>
        </>
      }
    >
      <form method="post" action={action} class="flex flex-col gap-2">
        <fieldset class="fieldset">
          <label for="email" class="fieldset-legend">
            Email
          </label>
          <label class="input validator w-full">
            <MailIcon class="size-4 opacity-50" />
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </label>
        </fieldset>

        <fieldset class="fieldset">
          <label for="password" class="fieldset-legend">
            Password
          </label>
          <label class="input w-full">
            <LockIcon class="size-4 opacity-50" />
            <input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </label>
        </fieldset>

        <button type="submit" class="btn btn-primary mt-4 w-full">
          Log in
        </button>
      </form>
    </AuthShell>
  );
};
