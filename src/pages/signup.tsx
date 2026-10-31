import { AuthShell } from '../components/auth-shell';
import { LockIcon, MailIcon, UserIcon } from '../components/icons';

type Props = {
  error?: string;
  name?: string;
  email?: string;
};

export const SignupPage = ({ error, name, email }: Props) => {
  return (
    <AuthShell
      heading="Create your account"
      subheading="It only takes a minute"
      error={error}
      footer={
        <>
          Already have an account?{' '}
          <a href="/login" class="link link-primary font-medium">
            Log in
          </a>
        </>
      }
    >
      <form method="post" action="/signup" class="flex flex-col gap-2">
        <fieldset class="fieldset">
          <label for="name" class="fieldset-legend">
            Name
          </label>
          <label class="input w-full">
            <UserIcon class="size-4 opacity-50" />
            <input
              id="name"
              type="text"
              name="name"
              value={name}
              placeholder="Ada Lovelace"
              autocomplete="name"
              required
            />
          </label>
        </fieldset>

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
          {/* Better Auth's default minimum password length is 8 */}
          <label class="input validator w-full">
            <LockIcon class="size-4 opacity-50" />
            <input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              autocomplete="new-password"
              minlength={8}
              required
            />
          </label>
          <p class="label">Must be at least 8 characters</p>
        </fieldset>

        <button type="submit" class="btn btn-primary mt-4 w-full">
          Create account
        </button>
      </form>
    </AuthShell>
  );
};
