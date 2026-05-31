REDAXO AddOn: svgcrop
=====================

Verlustfreies Zuschneiden und Optimieren von SVG-Dateien im REDAXO-Medienpool.

## Funktionen

- Fügt in Medienliste und Detailansicht einen Link SVG zuschneiden hinzu
- Link wird nur für SVG-Dateien angezeigt
- Entfernt überflüssigen Leerraum über eine angepasste viewBox (ideal für Logos)
- Optionales Web-Optimieren entfernt typischen Editor-Ballast (z. B. Adobe/Inkscape-Metadaten)
- Integriert ein lokales SVG-Edit direkt als Overlay in derselben Medienpool-Seite
- Übernimmt bearbeitete SVG-Inhalte aus SVG-Edit direkt zurück nach svgcrop ohne Tab-/Fensterwechsel
- Speichern als neue Datei oder Überschreiben (mit Berechtigung)

## Nutzung

1. SVG-Datei im Medienpool öffnen und SVG zuschneiden anklicken.
2. Optional SVG optimieren ausführen.
3. Optional Rand (Padding) setzen.
4. Leerraum entfernen ausführen.
5. Optional In SVG-Edit öffnen ausführen.
6. Im Overlay fertig bearbeiten und Übernehmen in SVG-Crop anklicken.
7. Speichern.

## Berechtigungen

- svgcrop[]: Addon nutzen
- svgcrop[overwrite]: bestehende SVG überschreiben
- svgcrop[svg_edit]: SVG-Edit-Integration öffnen

## Konfiguration

- show_edit_in_list: SVG-Bearbeitungslink in der Medienliste ein-/ausblenden
- svg_edit_url: Einstiegspunkt für die SVG-Edit-Integration (Standard ist das lokale Addon-Asset)
