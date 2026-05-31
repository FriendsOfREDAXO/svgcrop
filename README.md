REDAXO AddOn: svgcrop
=====================

Lossless SVG trimming and optimization in REDAXO mediapool.

## Features

- Adds an SVG edit link in mediapool list and detail view
- Link is only shown for SVG files
- Removes excess whitespace by updating viewBox to visible content
- Optional web optimization to remove common editor ballast (e.g. Adobe/Inkscape metadata)
- Save as new file or overwrite existing file (with dedicated permission)

## Usage

1. Open an SVG file in mediapool and click SVG zuschneiden.
2. Optionally run SVG optimieren.
3. Optionally define padding.
4. Run Leerraum entfernen.
5. Save.

## Permissions

- svgcrop[]: use addon
- svgcrop[overwrite]: allow overwrite of existing SVG

## Notes for Developers

Use a dedicated namespace for PHP classes, for example:

namespace FriendsOfRedaxo\Svgcrop
