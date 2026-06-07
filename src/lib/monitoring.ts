import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,

    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      }),
      Sentry.replayIntegration({
        // Block sensitive form fields from replay
        blockAllMedia: false,
        maskAllInputs: true,
        maskAllText: false
      })
    ],

    // 5% of page loads get performance tracing — keeps free quota usage low
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 1.0,

    // Session replay: 1% of normal sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Ignore noise from browser extensions and expected errors
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Network request failed",
      "Load failed",
      /^ChunkLoadError/
    ],

    beforeSend(event) {
      // Strip any auth tokens that might appear in breadcrumbs
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["authorization"];
      }
      return event;
    }
  });
}

export { Sentry };
