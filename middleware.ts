/**
 * Middleware for password protection
 * Redirects unauthenticated users to login page
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_PASSWORD = process.env.APP_PASSWORD || 'rolloy2025';
const AUTH_COOKIE_NAME = 'rolloy_auth';
const AUTH_TOKEN = 'authenticated_' + Buffer.from(APP_PASSWORD).toString('base64').slice(0, 16);

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and API routes (except protected ones)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check authentication cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  if (!authCookie || authCookie.value !== AUTH_TOKEN) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
