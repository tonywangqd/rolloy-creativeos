/**
 * Simple Password Authentication API
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Password from environment variable, default for development
const APP_PASSWORD = process.env.APP_PASSWORD || 'rolloy2025';
const AUTH_COOKIE_NAME = 'rolloy_auth';
const AUTH_TOKEN = 'authenticated_' + Buffer.from(APP_PASSWORD).toString('base64').slice(0, 16);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    if (password === APP_PASSWORD) {
      // Set authentication cookie (7 days)
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, AUTH_TOKEN, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Password incorrect' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}

// Logout endpoint
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
