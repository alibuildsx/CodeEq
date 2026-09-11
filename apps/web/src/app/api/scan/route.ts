import { NextRequest, NextResponse } from 'next/server';
import { ScanError } from '@/lib/errors';
import { scanGithubRepository } from '@/lib/scanner/scanService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScanRequestBody {
  repoUrl?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Content-Type / JSON verification
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_GITHUB_URL',
          message: 'Content-Type must be application/json',
        },
      },
      { status: 400 }
    );
  }

  let body: ScanRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_GITHUB_URL',
          message: 'Malformed or invalid JSON in request body',
        },
      },
      { status: 400 }
    );
  }

  // 2. Validate repoUrl input
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_GITHUB_URL',
          message: 'Request body must be a JSON object',
        },
      },
      { status: 400 }
    );
  }

  const { repoUrl } = body;

  if (typeof repoUrl !== 'string') {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_GITHUB_URL',
          message: 'repoUrl must be a string',
        },
      },
      { status: 400 }
    );
  }

  if (repoUrl.length > 500) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_GITHUB_URL',
          message: 'Repository URL exceeds maximum allowable length',
        },
      },
      { status: 400 }
    );
  }

  // 3. Execute scan service pipeline
  try {
    const result = await scanGithubRepository(repoUrl);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ScanError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.statusCode }
      );
    }

    // Catch-all for unexpected internal errors (never leak stack trace or local filesystem paths)
    return NextResponse.json(
      {
        error: {
          code: 'SCAN_FAILED',
          message: 'An unexpected internal error occurred during repository analysis',
        },
      },
      { status: 500 }
    );
  }
}
