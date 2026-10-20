import type { ReactNode } from "react";
import { siteConfig } from "./site-config";
import { useMediaQuery } from "./use-media-query";

/** A touch phone dials straight away; anything else jumps to the numbers. */
const DIRECT_CALL_QUERY =
  "(max-width: 900px) and (hover: none) and (pointer: coarse)";

/**
 * A "call sales" link.
 *
 * The prerender cannot know the visitor's device, so it renders the
 * `#phone-numbers` href and a phone flips it to `tel:` right after
 * hydration. The link reads the media query itself so that flip re-renders
 * only the link -- when the href was a prop, it re-rendered the whole price
 * list the link sits in (a second full render of every row, on every phone).
 */
export function ContactLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const isDirectCallDevice = useMediaQuery(DIRECT_CALL_QUERY);
  const href = isDirectCallDevice
    ? siteConfig.contact.phones[0].href
    : "#phone-numbers";
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}
