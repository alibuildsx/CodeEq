import { NextRequest, NextResponse } from 'next/server';
import {
  PUBLIC_SCAN_ERROR_MESSAGES,
  RequestTooLargeError,
  ScanError,
} from '@/lib/errors';
import { scanGithubRepository } from '@/lib/scanner/scanService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScanRequestBody {
  repoUrl?: unknown;
}

const MAX_REQUEST_BODY_BYTES = 4_096;

async function readBoundedBody(request: NextRequest): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    throw new RequestTooLargeError();
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
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
    body = JSON.parse(await readBoundedBody(request)) as ScanRequestBody;
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json(
        { error: { code: error.code, message: PUBLIC_SCAN_ERROR_MESSAGES[error.code] } },
        { status: error.statusCode },
      );
    }
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
            message: PUBLIC_SCAN_ERROR_MESSAGES[err.code],
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
