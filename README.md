REDAXO AddOn: svgcrop
=====================

Lossless SVG trimming and optimization in REDAXO mediapool.

## Features

- Adds an SVG edit link in the media list and file detail view
- The link is shown only for SVG files
- Removes unnecessary whitespace by updating the viewBox to visible content (ideal for logos)
- Optional web optimization removes common editor overhead (for example Adobe/Inkscape metadata)
- Save as a new file or overwrite the current file (requires dedicated permission)

## Usage

1. Open an SVG file in the media pool and click "SVG crop".
2. Optionally run "Optimize SVG".
3. Optionally set padding.
4. Run "Trim whitespace".
5. Save your result.

## Permissions

- svgcrop[]: use addon
- svgcrop[overwrite]: allow overwrite of existing SVG

## Notes for Developers

Use a dedicated namespace for PHP classes, for example:

namespace FriendsOfRedaxo\Svgcrop
