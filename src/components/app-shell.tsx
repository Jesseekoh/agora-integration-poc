import type { Child } from 'hono/jsx';
import { Script } from 'vite-ssr-components/hono';
import { CallDialog } from './call-dialog';
import { LogOutIcon, VideoIcon } from './icons';

type Props = {
  user: { id: string; name: string; email: string };
  active?: 'home' | 'groups' | 'users';
  children: Child;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

// Navbar + content area for signed-in pages
export const AppShell = ({ user, active, children }: Props) => (
  <>
    <header class="navbar gap-2 border-b border-base-300 bg-base-100 px-4 sm:px-8">
      <div class="flex flex-1 items-center gap-6">
        <a href="/" class="flex items-center gap-2 text-lg font-semibold">
          <span class="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-content">
            <VideoIcon class="size-4" />
          </span>
          <span class="hidden sm:inline">Agora POC</span>
        </a>
        <nav class="flex gap-1">
          <a href="/" class={`btn btn-ghost btn-sm ${active === 'home' ? 'btn-active' : ''}`}>
            Home
          </a>
          <a
            href="/groups"
            class={`btn btn-ghost btn-sm ${active === 'groups' ? 'btn-active' : ''}`}
          >
            Groups
          </a>
          <a
            href="/users"
            class={`btn btn-ghost btn-sm ${active === 'users' ? 'btn-active' : ''}`}
          >
            Users
          </a>
        </nav>
      </div>

      {/* CSS-only dropdown: daisyUI opens it on focus, so no client JS needed */}
      <div class="dropdown dropdown-end">
        <div
          tabindex={0}
          role="button"
          class="btn btn-ghost btn-circle avatar avatar-placeholder"
          aria-label="Account menu"
        >
          <div class="w-10 rounded-full bg-primary text-primary-content">
            <span class="text-sm font-medium">{initials(user.name)}</span>
          </div>
        </div>
        <ul
          tabindex={-1}
          class="menu dropdown-content z-10 mt-3 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        >
          <li class="menu-title">
            <span class="truncate text-base-content">{user.name}</span>
            <span class="truncate font-normal">{user.email}</span>
          </li>
          <li>
            <button type="submit" form="logout-form">
              <LogOutIcon />
              Log out
            </button>
          </li>
        </ul>
      </div>
      <form id="logout-form" method="post" action="/logout" hidden />
    </header>

    <main class="mx-auto max-w-4xl px-4 py-10 sm:px-8">{children}</main>

    {/* On every signed-in page, so incoming calls ring wherever the user is */}
    <CallDialog />
    <div id="call-config" data-user-id={user.id} hidden />
    <Script src="/src/client/calls.ts" />
  </>
);
