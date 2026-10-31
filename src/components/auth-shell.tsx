import type { Child } from 'hono/jsx';
import { AlertIcon, VideoIcon } from './icons';

type Props = {
  heading: string;
  subheading: string;
  error?: string;
  footer: Child;
  children: Child;
};

// Centered card shared by the login and signup pages
export const AuthShell = ({ heading, subheading, error, footer, children }: Props) => (
  <main class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <div class="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-content shadow-lg shadow-primary/30">
          <VideoIcon class="size-6" />
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p class="mt-1 text-sm text-base-content/60">{subheading}</p>
        </div>
      </div>

      <div class="card border border-base-300 bg-base-100 shadow-xl">
        <div class="card-body gap-4">
          {error && (
            <div role="alert" class="alert alert-error alert-soft text-sm">
              <AlertIcon class="size-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {children}
        </div>
      </div>

      <p class="mt-6 text-center text-sm text-base-content/70">{footer}</p>
    </div>
  </main>
);
