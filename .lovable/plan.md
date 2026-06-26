## Issues

**1. ATCR Trend chart Y-axis looks inconsistent**
Current ticks are `[40, 60, 80, 90, 100]` — uneven gaps (20, 20, 10, 10) make the gridlines look broken and the "90% goal" line sits at a weird height. The eye expects equal spacing.

**2. Agent Performance sparklines have no axes**
I hid the X and Y axes to keep the card compact. You're right that this hurts comprehension — the line floats with no scale or time reference, so users can't tell what range or period they're looking at.

## Proposed fixes

### ATCR Trend chart — clean Y-axis
Switch to evenly-spaced ticks: `[50, 60, 70, 80, 90, 100]` (steps of 10, domain 50–100).
- Gridlines become uniform.
- The 90% goal line lands naturally on a tick.
- Still tight enough to show meaningful variation (real values sit 55–95%).

### Agent Performance cards — add lightweight axes
Add minimal but real axes to each sparkline:

- **Y-axis (left)**: 2 ticks only — `50%` and `100%` — small grey text, no axis line. Just enough to anchor the scale.
- **X-axis (bottom)**: 2 ticks only — first date and last date (e.g. "Jun 9" … "Jun 22"), small grey text, no axis line.
- Keep the 90% goal reference line.
- Bump sparkline height from 64px → 90px to fit the labels without crowding.
- Keep the existing hover tooltip (date + ATCR%).

Result: still compact, but the chart now self-explains — user immediately sees "ATCR over these 14 days, ranged 50–100%, target 90%."

### Out of scope
- No change to color, layout, status dot, WoW pill, or stat chips.
- No change to data calculations.

## Files affected
- `src/routes/dashboard.tsx` — Y-axis `ticks` prop on the ATCR chart; AgentCard sparkline gets visible XAxis + YAxis with 2 ticks each and slightly taller container.
