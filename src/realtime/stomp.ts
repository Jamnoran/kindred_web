import { Client } from "@stomp/stompjs";
import type { StompSubscription } from "@stomp/stompjs";
import { API_BASE } from "../api/http";
import type { ChatEvent } from "../api/types";

// Single shared STOMP connection over /ws, authenticated by the SESSION
// cookie on the handshake. Events are fire-and-forget with no replay, so
// consumers must re-sync over REST on every (re)connect — subscribe to that
// moment via onConnected().

type EventHandler = (event: ChatEvent) => void;

function brokerURL(): string {
  const base = API_BASE || window.location.origin;
  return `${base.replace(/^http/, "ws")}/ws`;
}

const handlers = new Map<number, Set<EventHandler>>();
const subscriptions = new Map<number, StompSubscription>();
const connectListeners = new Set<() => void>();

let client: Client | null = null;

function ensureClient(): Client {
  if (client) return client;
  client = new Client({
    brokerURL: brokerURL(),
    reconnectDelay: 3000,
  });
  client.onConnect = () => {
    subscriptions.clear(); // stale after a reconnect
    for (const conversationId of handlers.keys()) {
      subscribeTopic(conversationId);
    }
    for (const listener of connectListeners) listener();
  };
  client.activate();
  return client;
}

function subscribeTopic(conversationId: number) {
  const c = ensureClient();
  if (!c.connected || subscriptions.has(conversationId)) return;
  const sub = c.subscribe(`/topic/conversations/${conversationId}`, (frame) => {
    let event: ChatEvent;
    try {
      event = JSON.parse(frame.body);
    } catch {
      return;
    }
    for (const handler of handlers.get(conversationId) ?? []) handler(event);
  });
  subscriptions.set(conversationId, sub);
}

/**
 * Subscribe to a conversation's events. Only call with ids returned by
 * GET /conversations — the server kills the connection for foreign ids.
 * Returns an unsubscribe function.
 */
export function subscribeConversation(conversationId: number, handler: EventHandler): () => void {
  let set = handlers.get(conversationId);
  if (!set) {
    set = new Set();
    handlers.set(conversationId, set);
  }
  set.add(handler);
  subscribeTopic(conversationId);

  return () => {
    const current = handlers.get(conversationId);
    current?.delete(handler);
    if (current && current.size === 0) {
      handlers.delete(conversationId);
      subscriptions.get(conversationId)?.unsubscribe();
      subscriptions.delete(conversationId);
    }
  };
}

/** Fires on every (re)connect — do your REST re-sync here. */
export function onConnected(listener: () => void): () => void {
  connectListeners.add(listener);
  if (client?.connected) listener();
  return () => {
    connectListeners.delete(listener);
  };
}

/** Publish a typing signal. Caller is responsible for throttling (~3s). */
export function sendTyping(conversationId: number) {
  const c = ensureClient();
  if (c.connected) {
    c.publish({ destination: `/app/conversations/${conversationId}/typing` });
  }
}

/** Tear down the socket (on logout). */
export function disconnect() {
  handlers.clear();
  subscriptions.clear();
  client?.deactivate();
  client = null;
}
