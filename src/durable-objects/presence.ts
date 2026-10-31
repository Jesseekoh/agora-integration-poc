import { DurableObject } from 'cloudflare:workers';
import { notifyUser } from '../lib/notify';

// A single instance (named 'global') holding the ids of every online user.
// Each UserNotifier reports its user's transitions here; on a change we push a
// `presence` event to everyone online so their users page can update the dots.
export class Presence extends DurableObject<CloudflareBindings> {
  private online = new Set<string>();

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    // Persisted so the set survives this instance being evicted
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.list<true>();
      this.online = new Set(stored.keys());
    });
  }

  async list(): Promise<string[]> {
    return [...this.online];
  }

  async setOnline(userId: string) {
    if (this.online.has(userId)) return;
    this.online.add(userId);
    await this.ctx.storage.put(userId, true);
    this.broadcast(userId, true);
  }

  async setOffline(userId: string) {
    if (!this.online.delete(userId)) return;
    await this.ctx.storage.delete(userId);
    this.broadcast(userId, false);
  }

  // Not awaited: a slow or unreachable notifier shouldn't hold up the caller
  private broadcast(userId: string, online: boolean) {
    for (const id of this.online) {
      notifyUser(this.env, id, 'presence', { userId, online }).catch(() => {});
    }
  }
}
