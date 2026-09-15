# Column roles and table comparison

## Confirmed scope

Declare dedicated be-net column roles during CSV/XLSX import. Build hierarchy paths from a node ID and parent ID, ordered organizational levels, or an existing slash path. Save relevant source data and declarations in each new-format database; reopening requires no source file. Ignore unmapped columns and do not support old database schemas.

Compare any two tables in the active database exclusively by employee ID. Show additions/removals, changed dedicated fields, hierarchy moves, and excluded records. Missing or ambiguous employee IDs are not matched. All hierarchies have one shared root.

## Direction contract

THESIS: Extend the existing import and Data menu with explicit column declarations and a review-before-import step. The user configures relationships without preparing path strings.

OWN-WORLD: Inherit the app's white surfaces, gray borders, dark-gray primary buttons, modest corner radii, and existing English/Hebrew typography. Preserve RTL and the surrounding tree UI.

STORY: Select a source, declare relationships and fields, preview the resulting connected tree, then import. Reopen saved data directly. Select before/after tables to inspect employee-level changes.

FIRST VIEWPORT: The import dialog shows compact source selection, three icon buttons for hierarchy formats, and visually connected parent/child selectors. A real tree replaces the form on preview. Comparison places the before/after selector toolbar above population totals, clickable change bars and grouped before/after distribution bars. Record details support chart drilldown.

FORM: A local extension of established Feather icons, gray buttons and typography. Charts communicate real counts, with muted semantic colors for change categories. No pie chart because categories overlap; every bar starts at zero and distributions include unspecified values. No visual-world replacement.

FINISH: Finish with a rendered review and verdict, and record the implemented surface here. This ordinary extension preserves the incumbent visual system; it does not introduce a new DESIGN.md or sidecar. Any shipping raster must carry provenance.

## Validation

Cover IDs with leading zeros, arbitrary input order, missing parents, cycles, duplicate node IDs, level gaps, one-root validation, generated units, ignored columns, persistence after reopening, and comparison exclusions. Verify English/Hebrew interfaces and narrow viewport behavior. No new shipping raster assets.

## Implemented responsive behavior and review

Below 640 px, the hierarchy preview is a connected nested list with full labels and logical-direction branch lines. At desktop widths, the SVG tree has zoom controls; the same nested list remains available to screen readers. The comparison selector toolbar stacks on mobile, and population totals use gray-500 for the earlier count to preserve legibility.

Rendered review artifacts are in `.impeccable/review/visual-*.png`, including the Hebrew mobile connected-tree preview. The finish review reported a ship verdict after the mobile tree and population contrast fixes. Live validation confirmed the reduced-motion CSS and observed the settings-tab opacity transition from 0.177 to 1. These are review observations, separate from the functional validation cases above.

## Motion contract

Focal interaction: source rows become a connected tree; comparison reveals measured differences and category buttons lead to records. Page and tree-view changes crossfade. Existing folder navigation, node expansion, menus and overlays retain their motion. Settings tabs, import setup/preview, result filters and dialog closure gain short transitions. Controls acknowledge hover/focus within 140 ms; state transitions take 150–200 ms and chart drawing up to 350 ms. Pan remains immediate during dragging. Reduced motion disables spatial animation and CSS transitions.

## References

- [Carbon chart selection](https://carbondesignsystem.com/data-visualization/chart-types/): comparison bars and hierarchy trees.
- [Carbon content switcher](https://carbondesignsystem.com/components/content-switcher/usage/): recognizable icons with explicit text labels.
- [PatternFly motion](https://www.patternfly.org/design-foundations/motion/): purposeful, brief state continuity.
