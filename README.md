# Sprite Grid Studio

A pixel-art sprite-sheet editor that splits a PNG into a grid of cells. Inspired by the Steam program Game Character Hub (independent, not affiliated).

**Try it:** https://bigwoodart.github.io/Sprite-Grid-Studio/ (Chrome or Edge recommended), or open `index.html` locally.

## Features
- Grid of cells: copy, paste, drag, flip, nudge; row animation preview and GIF export
- Layers, tabs, and `.gchproj` project files that keep layers separate
- Pencil, eraser, fill, gradient, shapes, magic wand, region select, pixel-exact adjust/rotate, noise, colorize
- Character Creator: build random characters from a folder of part images
- Unsaved edits, with undo history, survive a page reload

Press `?` in the app for shortcuts.

## Code
Plain HTML, CSS and JS (`index.html`, `css/`, `js/`) with no build step. Scripts share one global scope, so keep the load order in `index.html`.

## License
[MIT](LICENSE)
