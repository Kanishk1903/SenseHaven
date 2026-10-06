/** Shared sentence/relative-time generators (spec 4.4) — used by the Overview and the
 *  public Home demo so the demo literally speaks the product's sentences. */
import type { LiveState } from "@/features/apiHooks";

export function humanAgo(lastSeenAt: string | null, nowMs: number): { text: string; stale: boolean } {
  if (!lastSeenAt) return { text: "not seen yet", stale: true };
  const seconds = Math.max(0, Math.round((nowMs - new Date(lastSeenAt).getTime()) / 1000));
  if (seconds < 60) return { text: "just now", stale: false };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { text: `${minutes} min ago`, stale: seconds > 90 };
  const hours = Math.floor(minutes / 60);
  return { text: `${hours} h ${minutes % 60} min ago`, stale: true };
}


/** Status sentence (spec 4.4) — answers "Is everything OK right now?" in plain words. */
export function statusSentence(live: LiveState, name: string, lastStressAt: string | null): { h1: string } {
  const first = name || "Your child";
  const sinceText = (lastSeenAt: string | null): string => {
    if (!lastSeenAt) return "a while";
    const minutes = Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 60_000);
    if (minutes < 60) return `${Math.max(1, minutes)} min`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  };
  switch (live.state) {
    case "active": {
      const label = live.calm_index?.label;
      const rawMinutes = Math.max(0, live.remaining_s ?? 0) / 60;
      if (rawMinutes < 5) return { h1: `${Math.ceil(rawMinutes)} min left in ${name}'s session.` };
      const minutes = Math.round(rawMinutes);
      if (label === "calm") return { h1: `${first} is calm. ${minutes} min left in this session.` };
      if (label === "stressed" && lastStressAt) {
        const at = new Date(lastStressAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return { h1: `${first} has had a tense few minutes. A breather was offered at ${at}.` };
      }
      return { h1: `${first} is doing okay. ${minutes} min left in this session.` };
    }
    case "cooldown": {
      const at = lastStressAt
        ? new Date(lastStressAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "recently";
      return { h1: `${first} has had a tense few minutes. A breather was offered at ${at}.` };
    }
    case "offline":
      return { h1: `${first}'s phone hasn't checked in for ${sinceText(live.device?.last_seen_at ?? null)}. Limits still apply.` };
    case "locked":
      return live.session === null
        ? { h1: `${first} isn't in a session right now.` }
        : { h1: `${first}'s phone is locked.` };
    default:
      return { h1: `${first} isn't in a session right now.` };
  }
}

