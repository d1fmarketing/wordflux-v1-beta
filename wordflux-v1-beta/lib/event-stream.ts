import { randomUUID } from 'crypto';
import type { WritableStreamDefaultWriter } from 'stream/web';

import { sseBroadcastsTotal, sseConnectionsGauge } from './metrics';

type Writer = WritableStreamDefaultWriter<Uint8Array>;

interface Client {
  uid: string;
  writer: Writer;
  heartbeat: NodeJS.Timeout;
}

const encoder = new TextEncoder();
const channels = new Map<string, Set<Client>>();

function ensureChannel(key: string): Set<Client> {
  if (!channels.has(key)) {
    channels.set(key, new Set());
  }
  return channels.get(key)!;
}

function updateMetrics(key: string) {
  const set = channels.get(key);
  const size = set ? set.size : 0;
  sseConnectionsGauge.set({ channel: key }, size);
  if (size === 0) {
    // keep the gauge present but zeroed
    channels.delete(key);
  }
}

export function subscribe(channel: string, writer: Writer) {
  const clients = ensureChannel(channel);
  const uid = randomUUID();

  const heartbeat = setInterval(() => {
    writer.write(encoder.encode('event: ping\ndata: "ok"\n\n')).catch(() => {
      // swallow; removal handled on publish
    });
  }, 15000);
  if (typeof (heartbeat as any).unref === 'function') {
    (heartbeat as any).unref();
  }

  const client: Client = { uid, writer, heartbeat };
  clients.add(client);
  updateMetrics(channel);

  // Provide retry hint to intermediaries
  writer.write(encoder.encode('retry: 15000\n\n')).catch(() => {
    // ignore; caller will handle disconnect
  });

  const close = () => {
    clearInterval(heartbeat);
    clients.delete(client);
    updateMetrics(channel);
    try {
      writer.close();
    } catch {
      // ignore
    }
  };

  return { uid, close };
}

export function publish(channel: string, data: unknown) {
  const clients = channels.get(channel);
  if (!clients || clients.size === 0) {
    return;
  }

  const payload = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  sseBroadcastsTotal.inc({ channel });

  for (const client of Array.from(clients)) {
    client.writer.write(payload).catch(() => {
      clearInterval(client.heartbeat);
      clients.delete(client);
      updateMetrics(channel);
    });
  }
}

export function getActiveChannels(): Array<{ channel: string; clients: number }> {
  return Array.from(channels.entries()).map(([key, set]) => ({ channel: key, clients: set.size }));
}
