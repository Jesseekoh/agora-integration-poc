import { DurableObject } from 'cloudflare:workers';

const encoder = new TextEncoder();

// How long a user can have no streams before they count as offline. Every page
// navigation closes the SSE stream and opens a new one, so without this grace
// period users would flicker offline on each click.
const OFFLINE_GRACE_MS = 10_000;
// While online, an alarm re-checks the streams this often. Alarms outlive the
// instance, so if it restarts (e.g. a deploy) and the user never reconnects,
// this is what eventually marks them offline.
const ONLINE_CHECK_MS = 60_000;

// One instance per user (addressed by user id). It holds that user's open SSE
// streams, so any request, from any isolate, can push events to them via notify().
// The user is online while they have at least one stream open; transitions are
// reported to the Presence object.
export class UserNotifier extends DurableObject<CloudflareBindings> {
  private streams = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private userId: string | undefined;

  // Opens a new SSE stream. A user can have several (e.g. multiple tabs).
  // The route sets x-user-id; it's stored so alarm() knows who this is after a restart.
  async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get('x-user-id');
    if (userId && userId !== this.userId) {
      this.userId = userId;
      await this.ctx.storage.put('userId', userId);
    }

    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();
    this.streams.add(writer);
    this.send(writer, ': connected\n\n');
    this.startHeartbeat();

    if (this.streams.size === 1)
      await this.ctx.storage.setAlarm(Date.now() + ONLINE_CHECK_MS);
    // On every connect, not just the first: setOnline is a no-op when already
    // online, and this repairs Presence if an earlier update was lost
    if (userId) this.syncPresence(writer, userId).catch(() => {});

    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  }

  // Sends an event to every open stream. Returns how many streams it went to.
  async notify(event: string, data: unknown): Promise<number> {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const writer of this.streams) this.send(writer, message);
    return this.streams.size;
  }

  // Fires OFFLINE_GRACE_MS after the last stream closed, or periodically while online
  async alarm() {
    this.userId ??= await this.ctx.storage.get<string>('userId');
    if (this.streams.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + ONLINE_CHECK_MS);
      // Re-asserted so a user wrongly marked offline heals within one check
      if (this.userId) await this.presence().setOnline(this.userId);
      return;
    }
    if (this.userId) await this.presence().setOffline(this.userId);
  }

  // Marks the user online, then sends the new stream the full online list, so
  // the page can correct any dots rendered or missed before it connected
  private async syncPresence(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    userId: string,
  ) {
    const presence = this.presence();
    await presence.setOnline(userId);
    const online = await presence.list();
    this.send(
      writer,
      `event: presence-sync\ndata: ${JSON.stringify({ online })}\n\n`,
    );
  }

  // Not awaited: a closed connection rejects the write, which is how we drop it
  private send(writer: WritableStreamDefaultWriter<Uint8Array>, text: string) {
    writer.write(encoder.encode(text)).catch(() => this.drop(writer));
  }

  private drop(writer: WritableStreamDefaultWriter<Uint8Array>) {
    if (!this.streams.delete(writer)) return;
    writer.abort().catch(() => {});
    if (this.streams.size === 0) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
      this.ctx.storage.setAlarm(Date.now() + OFFLINE_GRACE_MS).catch(() => {});
    }
  }

  // A comment line every 25s keeps proxies from closing idle connections,
  // and surfaces dead ones so they get dropped
  private startHeartbeat() {
    this.heartbeat ??= setInterval(() => {
      for (const writer of this.streams) this.send(writer, ': ping\n\n');
    }, 25_000);
  }

  private presence() {
    return this.env.PRESENCE.get(this.env.PRESENCE.idFromName('global'));
  }
}
