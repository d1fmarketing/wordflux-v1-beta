import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { subscribe } from '@/lib/event-stream';
import { authOptions } from '@/lib/auth/options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const encoder = new TextEncoder();

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const boardId = url.searchParams.get('boardId') ?? 'default';
  const channel = `board:${boardId}`;

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const { close } = subscribe(channel, writer);

  const release = () => {
    close();
  };

  request.signal?.addEventListener('abort', release);

  // Send a comment to establish the stream for intermediaries
  writer.write(encoder.encode(': connected\n\n')).catch(() => {});

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
