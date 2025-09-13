import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // In production, you'd send this to a logging service like Sentry, LogRocket, etc.
    // For now, we'll just log to the server console
    if (process.env.NODE_ENV === 'production') {
      console.error('[CLIENT ERROR]', {
        timestamp: data.timestamp,
        message: data.message,
        url: data.url,
        source: data.source,
        // Don't log full stack in production for security
        stack: data.stack?.substring(0, 500),
      });
    } else {
      // In development, log everything
      console.error('[CLIENT ERROR]', data);
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to process error log:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Allow GET for health check
export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    message: 'Error logging endpoint is active' 
  });
}