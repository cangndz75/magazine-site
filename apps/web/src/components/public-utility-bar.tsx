import { formatPublicationDay } from "@/lib/format-publication-date";

/**
 * Thin editorial utility bar above the masthead. Only real, always-true
 * content: today's date. No fabricated market/weather data — see AGENTS.md
 * and the homepage redesign spec (§5): omit data points without a real
 * source rather than hardcoding placeholders.
 */
export function PublicUtilityBar() {
  const today = formatPublicationDay(new Date());

  return (
    <div className="public-utility-bar">
      <div className="public-utility-bar__inner">
        <span className="public-utility-bar__date">{today}</span>
      </div>
    </div>
  );
}
