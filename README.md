# Sprite Grid Studio

A pixel-art sprite-sheet editor inspired by the Steam art program Game Character Hub (this is an independent rebuild, not affiliated with it). There is no build step and no dependencies: open `index.html` in Chrome or Edge.

The sheet is split into a grid of cells. Cells can be selected, copied, pasted, dragged onto each other, flipped and nudged, and a row of cells plays as an animation.

## Features
- Open or paste a PNG; the grid is auto-detected and can be chosen from a preview dialog
- Layers (opacity, hide, merge, reorder) with thumbnails; tabs for several projects at once
- Project files (`.gchproj`) keep the layers separate; PNG export flattens them
- Reloading the page brings everything back: unchanged files reopen from disk (Chrome/Edge), and tabs with unsaved edits are restored from an autosaved draft, undo history included
- Tools: pencil, eraser, fill, gradient (linear/radial, stops, bands), line, rectangle, ellipse, eyedropper, select cells, select region (additive, restricts edits), magic wand (tolerance, Shift adds, Ctrl subtracts), move, adjust shape (pixel-exact), rotate/flip, noise, colorize
- Animation preview and GIF export
- Character Creator: point it at a folder of part folders (Body, Hair, Outfit...) and it stacks a random character; edit any piece in the editor and save it back

Press `?` in the app for the shortcut list.

## Project layout
```
index.html          page structure
css/style.css       all styles
js/                 plain scripts, loaded in this order by index.html
  core.js             helpers, app state, undo history
  view.js             canvas view, rendering, drawing primitives
  cell-ops.js         cell operations and cell selection
  tools.js            toolbar and pointer interaction
  colors.js           colors and palettes
  cells-panel.js      cells panel
  animation.js        animation preview
  gif.js              GIF encoder
  dialogs.js          modal helper, grid / new / open dialogs
  files.js            opening and saving PNGs and projects
  ui.js               UI sync and keyboard shortcuts
  layers.js           layers panel
  character-creator.js
  tabs.js             several projects at once
  adjust-tools.js     adjust shape, rotate, noise, colorize, gradient
  wand.js             magic wand and the brush/tolerance steppers
  session.js          autosaved drafts and reopening the last session after a reload
  boot.js             start-up
```
The scripts share one global scope (no modules) so the app also works when `index.html` is opened straight from disk. Keep the load order in `index.html`.

## Notes
- Saving back into the original file needs Chrome or Edge (File System Access API); other browsers download a copy.
- To try changes locally with a server: `python -m http.server` in this folder.
