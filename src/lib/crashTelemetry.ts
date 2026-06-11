import { supabase } from './supabase';
import * as Sentry from '@sentry/react';


export interface CrashDiagnostics {
  userAgent: string;
  screenSize: string;
  connection: string;
  pwaInstalled: boolean;
  currentPath: string;
  timestamp: string;
  devicePixelRatio: number;
  language: string;
}

/** Collect current browser diagnostics context */
export function getBrowserDiagnostics(): CrashDiagnostics {
  return {
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    connection: (navigator as any).connection?.effectiveType || 'unknown',
    pwaInstalled: window.matchMedia('(display-mode: standalone)').matches,
    currentPath: window.location.pathname + window.location.search,
    timestamp: new Date().toISOString(),
    devicePixelRatio: window.devicePixelRatio || 1,
    language: navigator.language || 'en-US',
  };
}

/** Send automated crash report to feedback_reports database table */
export async function reportAutomatedCrash(params: {
  title: string;
  error: Error;
  componentStack?: string;
}) {
  try {
    const diagnostics = getBrowserDiagnostics();

    // Log to Sentry
    Sentry.captureException(params.error, {
      extra: {
        title: params.title,
        componentStack: params.componentStack,
        diagnostics,
      },
    });

    // Log to browser developer console
    console.error(`[Crash Telemetry] ${params.title}`, {
      error: params.error,
      componentStack: params.componentStack,
      diagnostics
    });
    
    // Get currently logged-in user session if active
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    let description = `⚠️ AUTOMATED TELEMETRY CRASH LOG\n`;
    description += `===================================\n\n`;
    
    if (params.error.stack) {
      description += `[JS Error Stack]\n${params.error.stack}\n\n`;
    } else {
      description += `[Error Message]\n${params.error.name}: ${params.error.message}\n\n`;
    }

    if (params.componentStack) {
      description += `[React Component Stack]\n${params.componentStack}\n`;
    }

    const { error } = await (supabase as any).from('feedback_reports').insert({
      user_id: userId,
      type: 'bug',
      title: `[Auto-Crash] ${params.title.substring(0, 100)}`,
      description: description,
      device_info: diagnostics as any,
      status: 'pending',
    });

    if (error) {
      console.warn('[CrashTelemetry] Failed to insert error log:', error);
    } else {
      console.log('[CrashTelemetry] Telemetry successfully pushed to Supabase Cloud.');
    }
  } catch (err) {
    console.warn('[CrashTelemetry] Silent error in crash reporter:', err);
  }
}
