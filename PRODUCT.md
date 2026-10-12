# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

React developers selecting icons for application interfaces are the primary users. The hosted Explorer also serves developers and designers who need to find, compare, copy, and export assets across multiple icon providers.

## Product Purpose

`@rsocko/icon-picker` provides a framework-neutral React picker and renderer for emoji, Lucide, Material Design Icons, Phosphor, Dashboard Icons, and Simple Icons. It lets applications store a compact portable string instead of provider-specific objects, while the hosted demo and Explorer make the package's search, rendering, and provider support directly testable.

## Positioning

One portable value contract spans six icon sources while preserving provider-aware rendering and a React API. The package keeps core parsing and URL utilities usable without loading the picker or emoji search runtime.

## Operating Context

Consumers install the package in React applications, persist serialized icon values, and render them through `IconRenderer`. The hosted Explorer is a dense, keyboard-friendly workspace for searching complete provider catalogs, comparing colors and sizes, and copying useful representations.

## Capabilities and Constraints

- The public package supports React 18.2 through 19 and exports separate core, renderer, and picker entry points.
- Emoji are stored as raw characters; other providers use a `{source}:{name}` value.
- Iconify, Dashboard Icons, and Simple Icons assets are resolved from remote provider URLs. Emoji do not have a package-owned image URL.
- The package must remain client-side and framework-neutral within React.
- Advanced copy and export behavior should improve both the hosted Explorer and reusable package utilities, while preserving immediate one-click copying in the Explorer.

## Evidence on Hand

The repository includes the package source, full-page Explorer, component demo, automated tests, public API documentation, and live GitHub Pages deployment. It does not include customer testimonials, usage analytics, or provider-owned raster asset libraries.

## Product Principles

- Keep stored icon values portable and provider-independent.
- Make common icon selection and copying immediate.
- Expose provider differences honestly instead of presenting unsupported output as equivalent.
- Keep reusable utilities independent from the picker UI where practical.
- Preserve keyboard access, explicit feedback, and resilient network states.

## Accessibility & Inclusion

Interactive picker and Explorer behavior must remain keyboard operable, expose clear accessible names, announce asynchronous copy outcomes, and avoid making hover or pointer context menus the only route to an action.
