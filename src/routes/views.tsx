import { Hono, type Context } from 'hono';
import { isAPIError } from 'better-auth/api';
import { AppEnv } from '../types';
import { renderer } from '../renderer';
import { redirectIfAuthed, requireAuthPage } from '../middleware/auth';
import { asc, sql } from 'drizzle-orm';
import { groupMembers, groups, user } from '../db/schema';
import { HomePage } from '../pages/home';
import { GroupsPage, type GroupRow } from '../pages/groups';
import { UsersPage } from '../pages/users';
import { LoginPage } from '../pages/login';
import { SignupPage } from '../pages/signup';
import { onlineUserIds } from '../lib/notify';
import { callHistory, historyFilters, type HistoryFilter } from '../lib/call-history';
import { CallsPage } from '../pages/calls';

export const views = new Hono<AppEnv>();

views.use('*', renderer);

// Copy Better Auth's session cookies onto our own response
const forwardCookies = (c: Context, headers: Headers) => {
  for (const cookie of headers.getSetCookie()) {
    c.header('set-cookie', cookie, { append: true });
  }
};

const errorMessage = (err: unknown) =>
  isAPIError(err) ? err.message : 'Something went wrong. Please try again.';

// Only allow same-site relative paths, so ?next= can't redirect off-site
const safeNext = (next: string | undefined) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

views.get('/', requireAuthPage, (c) => {
  return c.render(<HomePage user={c.get('user')!} />, { title: 'Home' });
});

views.get('/groups', requireAuthPage, async (c) => {
  const userId = c.get('user')!.id;
  // Every group with its member count and whether the current user is in it
  const rows = await c
    .get('db')
    .select({
      id: groups.id,
      name: groups.name,
      memberCount: sql<number>`(select count(*) from ${groupMembers} where ${groupMembers.groupId} = ${groups.id})`,
      isMember: sql<number>`exists(select 1 from ${groupMembers} where ${groupMembers.groupId} = ${groups.id} and ${groupMembers.userId} = ${userId})`,
    })
    .from(groups)
    .orderBy(asc(groups.name));

  const mine: GroupRow[] = [];
  const others: GroupRow[] = [];
  for (const { isMember, ...group } of rows) {
    (isMember ? mine : others).push(group);
  }

  return c.render(<GroupsPage user={c.get('user')!} mine={mine} others={others} />, {
    title: 'Groups',
  });
});

views.get('/users', requireAuthPage, async (c) => {
  const me = c.get('user')!;
  const [rows, online] = await Promise.all([
    c.get('db')
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .orderBy(asc(user.name)),
    onlineUserIds(c.env),
  ]);
  // The viewer is online by definition, even before this page's SSE stream opens
  const users = rows.map((u) => ({ ...u, online: u.id === me.id || online.has(u.id) }));

  return c.render(<UsersPage user={me} users={users} />, { title: 'Users' });
});

views.get('/calls', requireAuthPage, async (c) => {
  const me = c.get('user')!;
  // Unknown ?filter= values just show everything
  const query = c.req.query('filter');
  const filter = historyFilters.find((f) => f === query) as HistoryFilter | undefined;
  const calls = await callHistory(c.get('db'), me.id, { filter, limit: 100 });

  return c.render(<CallsPage user={me} calls={calls} filter={filter} />, { title: 'Calls' });
});

views.get('/login', redirectIfAuthed, (c) => {
  return c.render(<LoginPage next={c.req.query('next')} />, {
    title: 'Log in',
  });
});

views.post('/login', redirectIfAuthed, async (c) => {
  const form = await c.req.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const next = c.req.query('next');

  try {
    const { headers } = await c.get('auth').api.signInEmail({
      body: { email, password },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardCookies(c, headers);
    return c.redirect(safeNext(next));
  } catch (err) {
    c.status(isAPIError(err) ? 401 : 500);
    return c.render(
      <LoginPage error={errorMessage(err)} email={email} next={next} />,
      {
        title: 'Log in',
      },
    );
  }
});

views.get('/signup', redirectIfAuthed, (c) => {
  return c.render(<SignupPage />, { title: 'Sign up' });
});

views.post('/signup', redirectIfAuthed, async (c) => {
  const form = await c.req.formData();
  const name = String(form.get('name') ?? '');
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  try {
    // autoSignIn is on by default, so this also creates a session
    const { headers } = await c.get('auth').api.signUpEmail({
      body: { name, email, password },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardCookies(c, headers);
    return c.redirect('/');
  } catch (err) {
    c.status(isAPIError(err) ? 422 : 500);
    return c.render(
      <SignupPage error={errorMessage(err)} name={name} email={email} />,
      {
        title: 'Sign up',
      },
    );
  }
});

views.post('/logout', async (c) => {
  try {
    const { headers } = await c.get('auth').api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardCookies(c, headers);
  } catch {
    // No session to end; just send them to the login page
  }
  return c.redirect('/login');
});
