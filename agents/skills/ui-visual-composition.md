<!--
  Source: https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/SKILL.md
  License: MIT — https://github.com/hueyexe/frontend-agent-skills/blob/main/LICENSE
  Author: hueyexe. Upstream references (same folder upstream, not vendored):
    - https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/principle-cards.md
    - https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/decision-prompts.md
    - https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/checklists.md
    - https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/anti-patterns.md
  Vendored as-is; check upstream for updates.
-->

---
name: ui-visual-composition
description: "Use when creating, critiquing, or refining visual UI, including hierarchy, spacing, typography, color, depth, imagery, or visual states."
license: MIT
metadata:
  author: hueyexe
---

# UI Visual Composition

## Purpose

Help an AI agent create and critique polished visual UI through hierarchy, spacing, typography, color, depth, imagery, and finishing details. Treat visual design as functional communication: the interface should help users understand what matters, what belongs together, what can be acted on, and what has changed.

This skill covers visual design quality, layout composition, typography, color systems, depth, imagery, polish, accessibility, and frontend implementation choices that affect visual quality. It does not cover deep UX research, information architecture strategy, or frontend architecture except where those concerns determine visual composition.

## When to use this skill

Use this skill when the user asks for UI critique, redesign, product-page improvement, frontend visual implementation, design-system guidance, style polish, layout refinement, typography, color palette, empty/error/loading state improvement, or visual QA of generated UI.

Also use it when producing frontend code for a visual interface, because component structure, semantic markup, tokens, state styling, responsive behavior, and accessibility details determine whether visual recommendations survive implementation.

## When not to use this skill

Do not use this skill as the primary framework when the user is asking mainly for user research planning, product strategy, market positioning, analytics instrumentation, backend/frontend architecture, performance engineering, copywriting without visual presentation, or detailed interaction flow design. Use it only for the visual-design portions of those tasks.

Do not use it to justify arbitrary decoration. If a visual suggestion does not improve hierarchy, comprehension, perceived quality, accessibility, or fit with product context, remove it.

## Core principles

1. **Start with the feature, not the shell.** Identify the concrete user task and content before designing navigation chrome, page framing, or decorative treatments.
2. **Hierarchy is the backbone.** Make the most important content and actions easiest to notice. Use size, weight, contrast, spacing, placement, and order before relying on color or ornament.
3. **Use familiar patterns unless novelty has a purpose.** Users bring mental models from other products. Preserve conventions for common controls, navigation, forms, and feedback unless the user’s brand or product goal justifies a deliberate departure.
4. **Group by meaning.** Proximity, common regions, alignment, and connectedness should match conceptual relationships. Ambiguous spacing creates ambiguous meaning.
5. **Constrain choices with systems.** Use type, spacing, color, radius, border, and elevation tokens instead of ad hoc one-off values.
6. **Typography is interface structure.** Choose type that fits the content and context, then set readable line length, line height, alignment, emphasis, and hierarchy.
7. **Color must carry meaning safely.** Use color to reinforce hierarchy, state, and brand, but never as the only signal. Maintain contrast and test against color-vision and low-vision needs.
8. **Depth should explain layers.** Shadows, overlaps, borders, and background shifts should clarify elevation, grouping, focus, or interaction—not create visual noise.
9. **Aesthetics improve acceptance but do not excuse usability flaws.** Polish can make users more tolerant and confident, but it can also mask problems. Verify clarity, accessibility, and task fit before celebrating beauty.
10. **Simplify without hiding necessary complexity.** Reduce visible choices and chunk complex tasks, but do not abstract away information users need to decide or recover.
11. **Design for resilient real content.** User-uploaded images, long labels, empty data, errors, loading, disabled states, and localization must not break the composition.
12. **Explain tradeoffs in user-centered terms.** Recommendations should reference user goals, comprehension, accessibility, system consistency, and implementation feasibility.

See [references/principle-cards.md](https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/principle-cards.md) for each principle as a reusable card.

## Default recommendations

| Area | Default | Override when |
|---|---|---|
| Product/task focus | Begin with one core feature or screen goal | User is explicitly asking for global navigation, design-system shell, or IA |
| Visual direction | Professional, warm, restrained, and content-first | Brand is playful, luxury, editorial, youth-focused, highly technical, or campaign-like — our Relay redesign intentionally overrides this toward playful rounded |
| Information density | Comfortable spacing first; reduce only deliberately | Dashboard, pro tool, or monitoring context requires high density |
| Layout strategy | Content-width container with clear groups; avoid filling the screen by default | Immersive canvas or media needs full width |
| Typography | System UI or high-quality neutral sans for UI; pair with one expressive display face only when brand calls for it | Editorial/brand work needs a distinct typographic voice — Relay uses a distinctive display + body pairing deliberately |
| Type scale | Small set of reusable steps for body, supporting text, labels, titles, and display | Existing design system has a scale |
| Color | Semantic roles from a limited palette: neutral scale, accent scale, success/warning/error/info, and focus states | Brand palette is fixed |
| Contrast | Treat contrast as a functional requirement; verify text, icons, controls, and states | Large decorative text exempt |
| Depth | Small elevation scale and one consistent light model | Brand is intentionally flat/brutalist |
| Empty states | Include helpful empty states with next action | Empty state is impossible — implement by default |
| Motion | Subtle, purposeful motion for feedback and continuity; respect reduced-motion preferences | Entertainment-heavy product — ask about motion appetite |
| Frontend implementation | Semantic HTML, design tokens, responsive CSS, visible focus states, keyboard access, state variants | Prototype is static and disposable |

## Required user questions

Do not ask users to confirm routine best practices such as readable text, sufficient contrast, or clear hierarchy. Apply those by default. Ask a focused question only when the answer materially changes the visual solution (product goal, brand tone, redesign inputs, stricter accessibility, volatile content, risky novelty, or framework constraints).

Use the question-tool-ready prompts in [references/decision-prompts.md](https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/decision-prompts.md) for the full decision set.

## Workflow: critique existing UI

Inspect in this order:

1. **Task and context fit.** Primary user goal, audience, platform, success criterion.
2. **Mental model and convention fit.** Common controls behave like users expect.
3. **Information hierarchy.** Visual hierarchy matches importance, not document order.
4. **Grouping and layout.** Proximity, alignment, common regions, responsive behavior.
5. **Typography.** Font choice, scale, line length/height, emphasis, long-content behavior.
6. **Color and contrast.** Palette roles, contrast, semantic states, no color-only meaning.
7. **Depth and layer logic.** Shadows, borders, overlaps, surface colors, focus hierarchy.
8. **Imagery and media.** Quality, crop, overlay contrast, UGC, alt text.
9. **States and resilience.** Empty, loading, error, disabled, focus, hover, selected, validation, destructive, success.
10. **Accessibility and inclusion.** Keyboard flow, focus, touch targets, motion sensitivity, screen-reader semantics.
11. **Frontend feasibility.** Tokens, semantic components, responsive CSS, maintainable variants.
12. **Prioritize fixes.** High-impact fixes, polish improvements, context-dependent tradeoffs.

## Workflow: create or improve UI

1. **Clarify the core feature.** Screen, task, audience, completion goal — content first, not chrome.
2. **List required elements.** Primary content, primary action, supporting actions, constraints, states.
3. **Choose the simplest useful structure.** Low fidelity first; avoid color/shadows/icons until structure works.
4. **Create hierarchy in grayscale.** Order, grouping, size, weight, spacing, contrast first; color after.
5. **Establish systems.** Type scale, spacing scale, grid/container rules, color roles, radius, borders, elevation tokens.
6. **Compose the layout.** Related elements near each other; unrelated clearly separated.
7. **Apply typography.** Readable body, strong titles, restrained labels, consistent emphasis.
8. **Apply color and states.** Color for brand, affordance, state, focus. Verify contrast + non-color cues.
9. **Add depth and imagery.** Shadows/overlap/background variation only where they clarify.
10. **Design edge states.** Empty, loading, error, disabled, selected, focus, hover, long-content, narrow-screen.
11. **Check accessibility and frontend implementation.** Semantic structure, keyboard flow, focus visibility, responsive behavior, tokenization, reduced-motion support.
12. **Explain decisions.** User-goal and system-quality improvements, not personal taste.

## Decision framework

1. **Does the decision affect task success?** Prefer clarity, familiarity, accessibility, recovery over novelty.
2. **Does it express product personality?** If yes and brand context is missing, ask. If no, use the restrained default.
3. **Does it reduce or increase cognitive load?** Chunk, disclose progressively, highlight recommended paths.
4. **Does it strengthen or confuse hierarchy?** Every visual cue should support a priority or relationship.
5. **Does it work with real content?** Long labels, empty data, dense data, UGC, localization, dark mode, responsive sizes.
6. **Can it be implemented consistently?** Tokenized, reusable patterns over custom one-offs.
7. **Is it accessible without special pleading?** If it relies on color alone, tiny targets, hidden focus, motion, fragile contrast, or ambiguous labels, revise.

## Practical rules

### Hierarchy
- Rank elements before styling them: primary, secondary, tertiary, ambient.
- Do not make every important thing large, bold, colored, and boxed. Emphasize the primary, de-emphasize the rest.
- One or two strong cues are often enough: size, weight, contrast, spacing, placement, color, depth.
- A destructive action is not automatically primary — style it by its role in the current task.

### Layout and spacing
- Start with generous whitespace, then remove until the layout fits the task.
- Use a constrained spacing scale with meaningfully different steps; avoid near-identical arbitrary values.
- Avoid ambiguous spacing: related items closer to each other than to other groups.
- Do not fill the whole screen by default; limit content width where full width harms grouping.
- Dense layouts are a deliberate choice for expert/monitoring/tabular tasks.

### Typography
- Choose type for content, audience, platform, brand — not fashion in isolation.
- Small type scale; avoid tiny differences that look accidental.
- Readable body: shorter line lengths for prose/cards, larger line-height for small text, tighter for large headings.
- Prefer left alignment for Latin-script body; centered text sparingly for short, low-density content.
- No more than a few consistent cues per hierarchy level.

### Color
- Define neutral, brand/accent, semantic, focus, and surface roles before applying broadly.
- Prefer HSL/OKLCH-like thinking; do not pick isolated hex values one at a time.
- Keep more shade steps than needed so hover/active/border/background/text states stay consistent.
- Never rely on color alone for errors, success, warnings, selected states, links, required fields.

### Depth, surfaces, and borders
- One consistent light model; small elevation scale (low: cards/controls, medium: popovers, high: modals).
- Prefer subtle background shifts, spacing, shadows, or accent edges over heavy borders everywhere.
- Flat design still needs depth cues: hierarchy, grouping, contrast, surface changes.

### Images and media
- Adequate resolution, strong crop, consistent style, clear purpose.
- Never place text on unpredictable images without contrast protection (overlay, gradient, panel, blur, crop).
- Treat user-uploaded images as hostile to layout and contrast.

### Finishing details
- Intentional focus rings, empty states, hover/active/disabled/selected/validation/loading states, microcopy.
- Empty states explain what is missing, why it matters, and what action to take next.
- High-leverage refinements: tighter heading line-height, icon alignment, clearer selected state, consistent radii, surface contrast, less border noise.

## Accessibility and inclusion requirements

- **Perceptibility:** contrast, size, labeling, alt text, redundant cues.
- **Operability:** comfortable targets, keyboard access, logical focus order, visible focus states.
- **Simplicity:** clear labels, reveal only relevant info, visible modes.
- **Forgiveness:** prevent errors, explain near the field, preserve input, support undo, deliberate destructive actions.
- Never color-alone. Respect reduced motion. Platform-appropriate touch targets. Inclusive imagery. WCAG AA-equivalent contrast by default.

## Frontend implementation guidance

- Semantic structure preserved: headings, landmarks, lists, buttons, links, form controls.
- Design tokens for spacing, type, colors, radius, elevation, z-index, motion.
- Responsive primitives: grid/flex, breakpoints, max-widths, fluid media.
- Variants for primary/secondary/tertiary/destructive, selected, hover, active, disabled, focus, loading, error, success.
- Real buttons for actions, real links for navigation. Visible consistent focus states.
- CSS variables for theming; reduced-motion queries; no blocking feedback behind long animations.

## Quality checklist

- Primary task and primary action are obvious.
- Works in grayscale before color is added.
- Related elements grouped by proximity/alignment/common regions.
- Spacing, type, color, radius, elevation use a limited system.
- Readable text, sensible line lengths, consistent hierarchy cues.
- Sufficient contrast; color never the only meaning carrier.
- Shadows/surfaces/borders express real grouping or elevation.
- Empty, loading, error, focus, disabled, selected, hover states covered.
- Touch targets, keyboard flow, focus visibility, screen-reader semantics considered.
- Handles long content, UGC, localization, narrow screens.

Use the full checklists in [references/checklists.md](https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/checklists.md).

## Common mistakes to avoid

- Designing the navigation shell before the feature.
- Adding color, shadows, gradients, icons before hierarchy is clear.
- Arbitrary pixel values instead of a spacing/type/color system.
- Making every important element visually loud.
- Color alone for links, errors, status, selection.
- Too many borders instead of spacing/grouping/background contrast.
- Pretty but unusable; over-simplifying away decision-critical info.
- Ignoring edge states because the happy path looks polished.

See [references/anti-patterns.md](https://github.com/hueyexe/frontend-agent-skills/blob/main/ui-visual-composition/references/anti-patterns.md) for the full anti-pattern list.

## How to explain recommendations

1. **Observation:** what the current design is doing.
2. **Effect:** likely user impact.
3. **Recommendation:** the specific change.
4. **Reason:** hierarchy, grouping, readability, accessibility, convention, implementation.
5. **Tradeoff:** when an alternative would be better.
