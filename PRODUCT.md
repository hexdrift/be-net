# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

be-net imports organizational data into local SQLite databases and displays interactive hierarchies. Column mapping lets users prepare data inside the application without an external transformation workflow.

## Capabilities and Constraints

- Support Excel/CSV imports and reopening databases previously created by be-net.
- Map only dedicated be-net fields; ignore unmapped source columns.
- Support parent-ID relationships, ordered hierarchy levels, and existing slash paths.
- Each hierarchy has one shared root; flag invalid structures.
- Save and restore column declarations per table; reopening shows the saved setup without requiring a source file.
- Compare two tables in one database using employee ID exclusively. Show additions/removals, field changes, and hierarchy moves. Exclude missing or duplicate IDs with reasons.
- Preserve English, Hebrew, and RTL support and the existing interface.

## Data Setup

New databases retain column declarations and only the source columns used by those declarations. Reopening restores the setup without requiring the source file. Older database formats need not be supported. The UI declares column roles during loading; it does not introduce a replace-table or edit-mapping workflow.
