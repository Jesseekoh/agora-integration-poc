/// <reference lib="dom" />
// Client side of calling: listens for call events over SSE, places calls from
// [data-callee-id] and [data-group-id] buttons, and drives the #call-dialog
// (see components/call-dialog.tsx).
import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
  ILocalVideoTrack,
  UID,
} from 'agora-rtc-sdk-ng';

type Media = 'audio' | 'video';
type CallType = 'direct' | 'group';

// Mirrors joinDetails() in routes/calls.ts
type JoinDetails = {
  callId: string;
  type: CallType;
  media: Media;
  appId: string;
  channel: string;
  uid: string;
  token: string;
};

type IncomingCall = {
  callId: string;
  type: CallType;
  media: Media;
  caller: { id: string; name: string; email: string };
  group?: { id: string; name: string };
};

type Session = {
  callId?: string; // unset until POST /calls/direct (or /calls/group) returns
  type: CallType;
  media: Media;
  phase: 'outgoing' | 'incoming' | 'connecting' | 'active';
  isCaller: boolean;
  title: string; // the other person's name, or the group's
  join?: JoinDetails;
  client?: IAgoraRTCClient;
  mic?: ILocalAudioTrack;
  cam?: ILocalVideoTrack;
  ready?: Promise<boolean>; // prepareTracks(), resolves false if the call ended meanwhile
  ringTimer?: ReturnType<typeof setTimeout>;
  clock?: ReturnType<typeof setInterval>;
  startedAt?: number;
};

// How long to ring before giving up. The callee's is longer so the caller's
// timeout (which ends the call server-side) normally wins.
const CALLER_RING_MS = 30_000;
const CALLEE_RING_MS = 45_000;

const config = document.getElementById('call-config');
const dialog = document.getElementById(
  'call-dialog',
) as HTMLDialogElement | null;

const $ = <T extends HTMLElement = HTMLElement>(attr: string) =>
  dialog!.querySelector<T>(`[${attr}]`)!;
const action = (name: string) =>
  $<HTMLButtonElement>(`data-call-action="${name}"`);

// Only one call at a time
let session: Session | null = null;

// Rejections/ends for calls we don't know the id of yet. A busy callee rejects
// instantly, so that event can beat the response to POST /calls/direct.
const settledEarly = new Map<string, 'rejected' | 'ended'>();

// Agora is big, so it's only fetched once a call actually needs it
let agora: Promise<typeof import('agora-rtc-sdk-ng').default> | undefined;
const loadAgora = () =>
  (agora ??= import('agora-rtc-sdk-ng').then(({ default: AgoraRTC }) => {
    AgoraRTC.setLogLevel(2); // warnings and up
    return AgoraRTC;
  }));

// ---------------------------------------------------------------- helpers

const api = async <T = void>(path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
};

const toast = (message: string, kind: 'info' | 'error' = 'info') => {
  const el = document.createElement('div');
  el.className = `alert ${kind === 'error' ? 'alert-error' : 'alert-info'} alert-soft text-sm`;
  el.textContent = message;
  document.querySelector('[data-call-toasts]')!.appendChild(el);
  setTimeout(() => el.remove(), 4000);
};

const errorText = (err: unknown) => {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    // Logged with its stack so the source can be traced in devtools
    console.error('Media access blocked:', err);
    return `Camera or microphone access is blocked. Allow it in your browser and device settings, then try again. (${err.name}: ${err.message})`;
  }
  return err instanceof Error ? err.message : String(err);
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- rendering

const statusText = (s: Session) => {
  const kind = s.media === 'video' ? 'video call' : 'voice call';
  switch (s.phase) {
    case 'outgoing':
      return `Calling… (${kind})`;
    case 'incoming':
      return `Incoming ${kind}`;
    case 'connecting':
      return 'Connecting…';
    case 'active':
      return duration(Date.now() - s.startedAt!);
  }
};

const setToggle = (button: HTMLButtonElement, on: boolean, label: string) => {
  button.querySelector<HTMLElement>('[data-on]')!.hidden = !on;
  button.querySelector<HTMLElement>('[data-off]')!.hidden = on;
  button.classList.toggle('btn-warning', !on);
  button.setAttribute('aria-label', label);
};

const render = () => {
  const s = session;
  if (!s) return;
  $('data-call-initials').textContent = initials(s.title);
  $('data-call-name').textContent = s.title;
  $('data-call-status').textContent = statusText(s);

  const ringing = s.phase === 'incoming';
  $('data-call-stage').hidden = s.media !== 'video' || ringing;
  action('accept').hidden = !ringing;
  action('decline').hidden = !ringing;
  action('hangup').hidden = ringing;
  action('mic').hidden = ringing;
  action('cam').hidden = ringing || s.media !== 'video';

  if (!dialog!.open) dialog!.showModal();
};

const remoteTile = (uid: UID) => {
  const remote = $('data-call-remote');
  let tile = remote.querySelector<HTMLElement>(
    `[data-uid="${CSS.escape(String(uid))}"]`,
  );
  if (!tile) {
    tile = document.createElement('div');
    tile.dataset.uid = String(uid);
    tile.className = 'aspect-video overflow-hidden rounded-box bg-neutral';
    remote.appendChild(tile);
  }
  remote.classList.toggle('sm:grid-cols-2', remote.children.length > 1);
  return tile;
};

// ---------------------------------------------------------------- lifecycle

// Ends the call locally: stops media, leaves the channel, closes the dialog.
// Telling the server is the caller's job (see hangUp).
const teardown = (message?: string, kind?: 'info' | 'error') => {
  const s = session;
  if (!s) return;
  session = null;

  clearTimeout(s.ringTimer);
  clearInterval(s.clock);
  s.mic?.close();
  s.cam?.close();
  if (s.client) {
    s.client.removeAllListeners();
    s.client.leave().catch(() => {});
  }
  $('data-call-remote').replaceChildren();
  $('data-call-local').replaceChildren();
  setToggle(action('mic'), true, 'Mute microphone');
  setToggle(action('cam'), true, 'Turn off camera');
  dialog!.close();

  if (message) toast(message, kind);
};

// Asks for mic (and camera) access. Video calls preview the camera straight away.
// getUserMedia is called before any await, while the tap that started this still
// counts as a user gesture: Firefox for Android otherwise refuses without prompting.
const createTracks = async (s: Session) => {
  const stream = navigator.mediaDevices.getUserMedia({
    audio: true,
    video: s.media === 'video',
  });
  const [AgoraRTC, media] = await Promise.all([loadAgora(), stream]);
  // The call may have ended while the permission prompt was up
  if (session !== s) {
    media.getTracks().forEach((t) => t.stop());
    return false;
  }
  s.mic = AgoraRTC.createCustomAudioTrack({
    mediaStreamTrack: media.getAudioTracks()[0]!,
  });
  const video = media.getVideoTracks()[0];
  if (video) {
    s.cam = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: video });
    s.cam.play($('data-call-local'));
  }
  return true;
};

const prepareTracks = (s: Session) => {
  s.ready = createTracks(s);
  // Whoever awaits s.ready handles a failure; this just keeps an early one from
  // being reported as unhandled before then
  s.ready.catch(() => {});
};

// Joins the Agora channel and publishes our tracks
const connect = async (s: Session, join: JoinDetails) => {
  s.phase = 'connecting';
  render();
  // The caller's permission prompt might still be open
  if (!(await s.ready)) return;

  const AgoraRTC = await loadAgora();
  console.log('Agora compatible:', AgoraRTC.checkSystemRequirements());
  const client = (s.client = AgoraRTC.createClient({
    mode: 'rtc',
    codec: 'vp8',
  }));

  client.on('connection-state-change', (cur, prev, reason) => {
    console.log(`Agora connection: ${prev} -> ${cur}`, reason ?? '');
    // LEAVE is our own client.leave(); anything else dropped us
    if (cur === 'DISCONNECTED' && reason && String(reason) !== 'LEAVE') {
      console.error('Agora disconnected:', reason);
    }
  });
  client.on('exception', (e) => {
    console.error(`Agora exception ${e.code}: ${e.msg} (uid ${e.uid})`);
  });
  client.on('token-privilege-will-expire', () => {
    console.warn('Agora token will expire soon');
  });
  client.on('token-privilege-did-expire', () => {
    console.error('Agora token expired');
  });

  client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'audio') user.audioTrack?.play();
    else user.videoTrack?.play(remoteTile(user.uid));
  });
  client.on('user-left', (user) => {
    $('data-call-remote')
      .querySelector(`[data-uid="${CSS.escape(String(user.uid))}"]`)
      ?.remove();
    // In a 1:1 call the other side leaving means the call is over, even if
    // they closed the tab without hanging up
    if (s.type === 'direct') void hangUp('Call ended');
  });

  const joinResult = await client.join(
    join.appId,
    join.channel,
    join.token,
    join.uid,
  );
  console.log('Agora joined channel', join.channel, 'as uid', joinResult);
  if (session !== s) return; // ended while joining; teardown already left

  await client.publish([s.mic, s.cam].filter((t) => !!t));
  if (session !== s) return;

  s.phase = 'active';
  s.startedAt = Date.now();
  s.clock = setInterval(render, 1000);
  render();
};

type Target =
  | { type: 'direct'; calleeId: string; name: string }
  | { type: 'group'; groupId: string; name: string };

// Start a 1:1 call from the users page, or a group call from the groups page.
// Either way we ring until someone answers, then join the channel (see onAccepted).
const placeCall = async (target: Target, media: Media) => {
  if (session) return toast("You're already in a call", 'error');

  const { name } = target;
  const s: Session = (session = {
    type: target.type,
    media,
    phase: 'outgoing',
    isCaller: true,
    title: name,
  });
  render();

  // Get the permission prompt out of the way while it rings
  prepareTracks(s);
  const callerId = config!.dataset.userId;
  const join$ =
    target.type === 'direct'
      ? api<JoinDetails>('/calls/direct', {
          callerId,
          calleeId: target.calleeId,
          media,
        })
      : api<JoinDetails>('/calls/group', {
          callerId,
          groupId: target.groupId,
          media,
        });

  try {
    const join = await join$;
    s.callId = join.callId;
    s.join = join;
    if (session !== s) {
      // Cancelled before the server answered, so the call was never ended
      void api(`/calls/${join.callId}/end`).catch(() => {});
      return;
    }
    const early = settledEarly.get(join.callId);
    if (early)
      return teardown(
        early === 'rejected' ? `${name} declined the call` : 'Call ended',
      );
    const unanswered =
      target.type === 'direct'
        ? `${name} didn't answer`
        : `No one in ${name} answered`;
    s.ringTimer = setTimeout(() => hangUp(unanswered), CALLER_RING_MS);
    await s.ready;
  } catch (err) {
    // e.g. the mic permission was denied: stop the callee's phone ringing too
    if (session === s) await hangUp(errorText(err), 'error');
  }
};

const acceptCall = async () => {
  const s = session;
  if (!s || s.phase !== 'incoming') return;
  clearTimeout(s.ringTimer);
  s.phase = 'connecting';
  render();
  prepareTracks(s); // before the await below, so the Accept tap still counts

  try {
    const join = await api<JoinDetails>(`/calls/${s.callId}/accept`);
    s.join = join;
    await connect(s, join);
  } catch (err) {
    if (session !== s) return;
    await hangUp(errorText(err), 'error');
  }
};

const declineCall = async () => {
  const s = session;
  if (!s || s.phase !== 'incoming') return;
  teardown();
  if (s.type === 'direct')
    await api(`/calls/${s.callId}/reject`).catch(() => {});
};

// Leave the call and, where we're allowed to, end it for everyone else.
// Group members who didn't start the call just leave.
async function hangUp(message?: string, kind?: 'info' | 'error') {
  const s = session;
  if (!s) return;
  teardown(message, kind);
  if (s.callId && (s.type === 'direct' || s.isCaller)) {
    await api(`/calls/${s.callId}/end`).catch(() => {});
  }
}

// ---------------------------------------------------------------- server events

const onIncoming = (call: IncomingCall) => {
  if (session) {
    // Busy: decline 1:1 calls straight away so the caller isn't left hanging
    if (call.type === 'direct')
      void api(`/calls/${call.callId}/reject`).catch(() => {});
    return toast(`Missed a call from ${call.caller.name} while busy`);
  }

  const s: Session = (session = {
    callId: call.callId,
    type: call.type,
    media: call.media,
    phase: 'incoming',
    isCaller: false,
    title: call.group
      ? `${call.group.name} (${call.caller.name})`
      : call.caller.name,
  });
  s.ringTimer = setTimeout(() => {
    if (session === s && s.phase === 'incoming')
      teardown(`Missed call from ${call.caller.name}`);
  }, CALLEE_RING_MS);
  render();
};

const onAccepted = ({ callId }: { callId: string }) => {
  const s = session;
  if (!s || s.callId !== callId) return;
  // We answered in another tab
  if (s.phase === 'incoming') return teardown('Answered in another tab');
  if (s.phase !== 'outgoing') return;

  clearTimeout(s.ringTimer);
  connect(s, s.join!).catch((err) => {
    if (session === s) void hangUp(errorText(err), 'error');
  });
};

const onRejected = ({ callId }: { callId: string }) => {
  const s = session;
  if (!s || s.callId !== callId)
    return void settledEarly.set(callId, 'rejected');
  teardown(s.phase === 'incoming' ? undefined : `${s.title} declined the call`);
};

const onEnded = ({ callId }: { callId: string }) => {
  const s = session;
  if (!s || s.callId !== callId) return void settledEarly.set(callId, 'ended');
  teardown(
    s.phase === 'incoming' ? `Missed call from ${s.title}` : 'Call ended',
  );
};

const setDot = (el: HTMLElement, online: boolean) => {
  el.classList.toggle('avatar-online', online);
  el.classList.toggle('avatar-offline', !online);
  el.title = online ? 'Online' : 'Offline';
};

// Updates the dot on the users page (pages/users.tsx)
const onPresence = ({
  userId,
  online,
}: {
  userId: string;
  online: boolean;
}) => {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-presence-id="${userId}"]`,
  )) {
    setDot(el, online);
  }
};

// Sent on every (re)connect: resets all dots, covering events missed while disconnected
const onPresenceSync = ({ online }: { online: string[] }) => {
  const ids = new Set(online);
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-presence-id]',
  )) {
    setDot(el, ids.has(el.dataset.presenceId!));
  }
};

// ---------------------------------------------------------------- wiring

if (config && dialog) {
  const events = new EventSource('/api/events');
  const on = <T>(name: string, handler: (data: T) => void) =>
    events.addEventListener(name, (e) =>
      handler(JSON.parse((e as MessageEvent).data)),
    );
  on('incoming-call', onIncoming);
  on('call-accepted', onAccepted);
  on('call-rejected', onRejected);
  on('call-ended', onEnded);
  on('presence', onPresence);
  on('presence-sync', onPresenceSync);

  document.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>(
      '[data-callee-id], [data-group-id]',
    );
    if (!button) return;
    const { calleeId, calleeName, groupId, groupName, media } = button.dataset;
    const target: Target = groupId
      ? { type: 'group', groupId, name: groupName ?? 'Group' }
      : { type: 'direct', calleeId: calleeId!, name: calleeName ?? 'Unknown' };
    void placeCall(target, media === 'video' ? 'video' : 'audio');
  });

  action('accept').addEventListener('click', () => void acceptCall());
  action('decline').addEventListener('click', () => void declineCall());
  action('hangup').addEventListener('click', () => void hangUp());

  action('mic').addEventListener('click', async () => {
    const mic = session?.mic;
    if (!mic) return;
    await mic.setMuted(!mic.muted);
    setToggle(
      action('mic'),
      !mic.muted,
      mic.muted ? 'Unmute microphone' : 'Mute microphone',
    );
  });
  action('cam').addEventListener('click', async () => {
    const cam = session?.cam;
    if (!cam) return;
    await cam.setMuted(!cam.muted);
    setToggle(
      action('cam'),
      !cam.muted,
      cam.muted ? 'Turn on camera' : 'Turn off camera',
    );
  });

  // Escape would close the dialog without ending the call
  dialog.addEventListener('cancel', (e) => e.preventDefault());

  // Leaving the page ends the call; sendBeacon still goes out as the page unloads
  window.addEventListener('pagehide', () => {
    const s = session;
    if (
      s?.callId &&
      s.phase !== 'incoming' &&
      (s.type === 'direct' || s.isCaller)
    ) {
      navigator.sendBeacon(`/api/calls/${s.callId}/end`);
    }
  });
}
