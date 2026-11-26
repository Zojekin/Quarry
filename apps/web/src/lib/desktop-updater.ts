import { useEffect, useState } from "react";
import type { DesktopUpdaterBridge, DesktopUpdateState } from "@quarry/shared";

export function getDesktopUpdater() {
  return typeof window === "undefined" ? undefined : window.__QUARRY_DESKTOP__?.updater;
}

export function useDesktopUpdateState(updater: DesktopUpdaterBridge | undefined) {
  const [state, setState] = useState<DesktopUpdateState | null>();

  useEffect(() => {
    if (!updater) return;
    let active = true;
    let receivedEvent = false;
    const unsubscribe = updater.onStateChange((next) => {
      receivedEvent = true;
      if (active) setState(next);
    });
    void updater.getState().then(
      (initial) => { if (active && !receivedEvent) setState(initial); },
      () => { if (active && !receivedEvent) setState(null); },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [updater]);

  return state;
}
