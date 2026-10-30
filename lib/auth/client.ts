'use client';

import { createAuthClient } from '@neondatabase/auth/next';

/** The browser auth client. It talks to app/api/auth/[...path]. */
export const authClient = createAuthClient();
