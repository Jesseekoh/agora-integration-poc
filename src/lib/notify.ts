// Push an SSE event to every stream the user has open. Resolves to the number of
// streams it reached (0 means the user isn't connected right now).
export const notifyUser = (
  env: CloudflareBindings,
  userId: string,
  event: string,
  data: unknown,
) => {
  const stub = env.USER_NOTIFIER.get(env.USER_NOTIFIER.idFromName(userId));
  return stub.notify(event, data);
};

// Ids of every user with the app open somewhere (see durable-objects/presence.ts)
export const onlineUserIds = async (env: CloudflareBindings) => {
  const stub = env.PRESENCE.get(env.PRESENCE.idFromName('global'));
  return new Set(await stub.list());
};
