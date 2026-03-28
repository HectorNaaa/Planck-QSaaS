# Vercel Deployment Guide

## Environment Variables Required

Vercel will automatically deploy from the main branch. You need to set these environment variables in the Vercel project settings:

### Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

### Database (if using direct Postgres connection)
- `POSTGRES_URL` - Full connection string with pooling
- `POSTGRES_URL_NON_POOLING` - Connection string without pooling
- `POSTGRES_HOST` - Database host
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DATABASE` - Database name

### Supabase Service Credentials (Server-side only)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server-side operations
- `SUPABASE_JWT_SECRET` - JWT secret for auth tokens

### Stripe (Optional for payments)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Public stripe key
- `STRIPE_SECRET_KEY` - Secret stripe key

## Authentication Flow

The application now uses a simplified authentication system:

1. **Sign Up** (`/auth/sign-up`)
   - Users create account with email and password
   - Additional profile information collected (name, country, phone, occupation)
   - Verification email sent via Supabase Auth

2. **Sign In** (`/auth/login`)
   - Email and password authentication
   - Session managed via Supabase Auth

3. **Middleware Security**
   - Routes `/api/quantum` and `/api/auth` are excluded from middleware
   - This prevents request body consumption issues
   - Guest access available via `/auth/login` with guest mode

## How Deployment Works

1. Push code to `main` branch on GitHub
2. Vercel automatically detects changes
3. Runs `pnpm install` and `pnpm run build`
4. Deploys to production if build succeeds

## Recent Changes

- Merged feature/simplified-auth branch to main
- Fixed middleware configuration to exclude authentication routes
- Added environment documentation
- Verified build process works correctly

## Troubleshooting

If you encounter authentication issues:
1. Verify all Supabase environment variables are set in Vercel
2. Check that `.env.local` is not committed (only `.env.example`)
3. Ensure Supabase project has auth enabled
4. Check email confirmation settings in Supabase dashboard
