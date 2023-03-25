import { useEffect, useMemo, useState } from "react";
import { u256 } from "@snort/nostr";
import { EventKind, Subscriptions } from "@snort/nostr";
import useSubscription from "Feed/Subscription";
import { useSelector } from "react-redux";
import { RootState } from "State/Store";
import { UserPreferences } from "State/Login";
import { debounce, NostrLink } from "Util";

export default function useThreadFeed(link: NostrLink) {
  const [trackingEvents, setTrackingEvent] = useState<u256[]>([link.id]);
  const pref = useSelector<RootState, UserPreferences>(s => s.login.preferences);

  function addId(id: u256[]) {
    setTrackingEvent(s => {
      const orig = new Set(s);
      if (id.some(a => !orig.has(a))) {
        const tmp = new Set([...s, ...id]);
        return Array.from(tmp);
      } else {
        return s;
      }
    });
  }

  const sub = useMemo(() => {
    const thisSub = new Subscriptions();
    thisSub.Id = `thread:${link.id.substring(0, 8)}`;
    thisSub.Ids = new Set(trackingEvents);

    // get replies to this event
    const subRelated = new Subscriptions();
    subRelated.Kinds = new Set(
      pref.enableReactions
        ? [EventKind.Reaction, EventKind.TextNote, EventKind.Repost, EventKind.ZapReceipt]
        : [EventKind.TextNote, EventKind.ZapReceipt]
    );
    subRelated.ETags = thisSub.Ids;
    thisSub.AddSubscription(subRelated);

    return thisSub;
  }, [trackingEvents, pref, link.id]);

  const main = useSubscription(sub, { leaveOpen: true, cache: true });

  useEffect(() => {
    if (main.store) {
      return debounce(200, () => {
        const mainNotes = main.store.notes.filter(a => a.kind === EventKind.TextNote);

        const eTags = mainNotes
          .filter(a => a.kind === EventKind.TextNote)
          .map(a => a.tags.filter(b => b[0] === "e").map(b => b[1]))
          .flat();
        const ids = mainNotes.map(a => a.id);
        const allEvents = new Set([...eTags, ...ids]);
        addId(Array.from(allEvents));
      });
    }
  }, [main.store]);

  return main.store;
}
