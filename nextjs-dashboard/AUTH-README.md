# Dashboard Authentication

This dashboard is protected by password authentication. All routes are protected and require login.

## Security Features

✅ **Password Protection**: All routes and API endpoints are protected by middleware
✅ **Server-Side Only**: Password is stored securely in environment variables (never exposed to browser)
✅ **Secure Cookies**: HttpOnly cookies prevent client-side JavaScript access
✅ **Session Management**: 7-day session with secure cookie settings

## Setup

1. The password is already configured in `.env.local` file
2. The middleware automatically protects all routes
3. Users must login at `/login` to access the dashboard

## How It Works

### Middleware Protection
The `middleware.ts` file intercepts all requests and:
- Checks for authentication cookie
- Redirects unauthenticated users to `/login`
- Allows authenticated users to access the dashboard

### Login Process
1. User enters password on login page
2. Password is sent to `/api/auth/login` (server-side)
3. Server validates against `DASHBOARD_PASSWORD` environment variable
4. On success, sets secure HttpOnly cookie
5. User is redirected to dashboard

### Logout Process
- Click "Sair" button in dashboard header
- Calls `/api/auth/logout` to clear authentication cookie
- Redirects back to login page

## Security Notes

⚠️ **Password Storage**: Password is stored in `.env.local` (gitignored)
⚠️ **Cookie Security**: Cookies are HttpOnly and Secure in production
⚠️ **No Client Access**: Password never reaches browser/client code

## Files Created

- `middleware.ts` - Route protection
- `app/login/page.tsx` - Login interface
- `app/api/auth/login/route.ts` - Authentication endpoint
- `app/api/auth/logout/route.ts` - Logout endpoint
- `.env.local` - Password configuration (gitignored)

## Current Password

The dashboard password is: **Vale0610!**

To change it, update the `DASHBOARD_PASSWORD` value in `.env.local` and restart the development server.




