import { QueryClient } from '@tanstack/react-query'

/** The app's query client, importable from non-React code (toasts, commands) that has to refresh cached lists. */
export const queryClient = new QueryClient()
