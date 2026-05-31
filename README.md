REDAXO AddOn: svgcrop
=====================

Lossless SVG trimming and optimization in REDAXO mediapool.

## Features

- Adds an SVG edit link in the media list and file detail view
- The link is shown only for SVG files
- Removes unnecessary whitespace by updating the viewBox to visible content (ideal for logos)
- Fits SVG content into configurable target ratios for logo tiles and media formats
- Optional web optimization removes common editor overhead (for example Adobe/Inkscape metadata)
- Integrates local SVG-Edit directly as an overlay in the same media pool page
- Returns edited SVG content back into svgcrop without tab/window switching
- Provides a hidden settings page in the media pool with gear access for administrators/settings users
- Save as a new file or overwrite the current file (requires dedicated permission)

## Usage

1. Open an SVG file in the media pool and click "SVG crop".
2. Optionally run "Optimize SVG".
3. Optionally set padding.
4. Optionally choose a ratio profile and run "Fit to ratio".
5. Run "Trim whitespace" when needed.
6. Optionally open "Open in SVG-Edit".
7. In the overlay, finish editing and click "Apply to SVG-Crop".
8. Save your result.

## Permissions

- svgcrop[]: use addon
- svgcrop[overwrite]: allow overwrite of existing SVG
- svgcrop[svg_edit]: allow opening SVG-Edit integration
- svgcrop[settings]: allow access to svgcrop settings page

## Configuration

- show_edit_in_list: show or hide SVG edit link in media list
- svg_edit_url: entry URL for the SVG-Edit integration (default is local addon asset)
- default_trim_padding: default padding value for trim/ratio actions
- ratio_profiles_json: configurable ratio profiles including label, width, height, mode, and anchor

## Settings Page

- Hidden media pool subpage with gear icon access
- Intended for administrators or users with svgcrop[settings]
- Lets you manage edit-link visibility, SVG-Edit URL, default padding, and multiple ratio profiles

## Notes for Developers

Use a dedicated namespace for PHP classes, for example:

namespace FriendsOfRedaxo\Svgcrop
