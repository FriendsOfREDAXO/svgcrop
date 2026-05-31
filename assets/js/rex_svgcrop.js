(function () {
    'use strict';

    function parseLength(value) {
        if (typeof value !== 'string') {
            return null;
        }

        var match = value.trim().match(/^(-?\d+(?:\.\d+)?)/);
        if (!match) {
            return null;
        }

        var parsed = parseFloat(match[1]);
        return isFinite(parsed) ? parsed : null;
    }

    function removeCommentNodes(node) {
        var child = node.firstChild;
        while (child) {
            var next = child.nextSibling;
            if (child.nodeType === 8) {
                node.removeChild(child);
            } else if (child.nodeType === 1) {
                removeCommentNodes(child);
            }
            child = next;
        }
    }

    function optimizeSvg(svg) {
        removeCommentNodes(svg);

        var removeTags = ['metadata', 'sodipodi:namedview'];
        svg.querySelectorAll('*').forEach(function (node) {
            if (removeTags.indexOf(node.nodeName.toLowerCase()) !== -1 && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });

        var namespaceAttrsToRemove = [
            'xmlns:dc',
            'xmlns:cc',
            'xmlns:rdf',
            'xmlns:inkscape',
            'xmlns:sodipodi',
            'xmlns:serif',
            'xmlns:i',
            'xmlns:graph'
        ];
        namespaceAttrsToRemove.forEach(function (attrName) {
            if (svg.hasAttribute(attrName)) {
                svg.removeAttribute(attrName);
            }
        });

        var allNodes = svg.querySelectorAll('*');
        allNodes.forEach(function (node) {
            Array.from(node.attributes).forEach(function (attr) {
                var name = attr.name;
                var lowerName = name.toLowerCase();

                if (lowerName.indexOf('inkscape:') === 0 || lowerName.indexOf('sodipodi:') === 0) {
                    node.removeAttribute(name);
                    return;
                }

                if ('id' !== lowerName && lowerName.indexOf('data-') === 0) {
                    node.removeAttribute(name);
                    return;
                }

                if ('enable-background' === lowerName || 'xml:space' === lowerName) {
                    node.removeAttribute(name);
                }
            });
        });

        var defsNodes = svg.querySelectorAll('defs');
        defsNodes.forEach(function (defs) {
            if (!defs.children.length && defs.parentNode) {
                defs.parentNode.removeChild(defs);
            }
        });

        if (!svg.hasAttribute('viewBox')) {
            var width = parseLength(svg.getAttribute('width') || '');
            var height = parseLength(svg.getAttribute('height') || '');
            if (null !== width && null !== height && width > 0 && height > 0) {
                svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            }
        }

        if (svg.hasAttribute('viewBox')) {
            svg.removeAttribute('width');
            svg.removeAttribute('height');
        }
    }

    function getBoundingBox(svgElement) {
        function parseViewBox(viewBoxValue) {
            if (typeof viewBoxValue !== 'string') {
                return null;
            }

            var parts = viewBoxValue.trim().split(/\s+|,/).map(function (part) {
                return parseFloat(part);
            });

            if (parts.length !== 4 || parts.some(function (num) { return !isFinite(num); })) {
                return null;
            }

            if (parts[2] <= 0 || parts[3] <= 0) {
                return null;
            }

            return {
                x: parts[0],
                y: parts[1],
                width: parts[2],
                height: parts[3]
            };
        }

        function boxArea(box) {
            return box.width * box.height;
        }

        function isSignificantlySmaller(candidate, reference) {
            if (!candidate || !reference) {
                return true;
            }

            return boxArea(candidate) < boxArea(reference) * 0.995;
        }

        var currentViewBox = parseViewBox(svgElement.getAttribute('viewBox') || '');

        // Prefer the browser-computed bbox of the rendered SVG root.
        // This usually respects what is actually visible better than iterating all descendants.
        if (typeof svgElement.getBBox === 'function') {
            try {
                var rootBox = svgElement.getBBox();
                if (
                    isFinite(rootBox.x) &&
                    isFinite(rootBox.y) &&
                    isFinite(rootBox.width) &&
                    isFinite(rootBox.height) &&
                    rootBox.width > 0 &&
                    rootBox.height > 0
                ) {
                    return {
                        x: rootBox.x,
                        y: rootBox.y,
                        width: rootBox.width,
                        height: rootBox.height
                    };
                }

                if (isSignificantlySmaller(rootBox, currentViewBox)) {
                    return {
                        x: rootBox.x,
                        y: rootBox.y,
                        width: rootBox.width,
                        height: rootBox.height
                    };
                }
            } catch (error) {
                // Fallback to per-node bbox calculation.
            }
        }

        var nodes = svgElement.querySelectorAll('*');
        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;

        function shouldSkipForBBox(node) {
            if (!node || !node.tagName) {
                return true;
            }

            var hiddenByDisplay = node.getAttribute('display');
            if (hiddenByDisplay && hiddenByDisplay.toLowerCase() === 'none') {
                return true;
            }

            // Ignore definition and helper containers that do not render directly.
            if (node.closest('defs,clipPath,mask,pattern,symbol,marker,linearGradient,radialGradient,filter')) {
                return true;
            }

            return false;
        }

        nodes.forEach(function (node) {
            if (typeof node.getBBox !== 'function') {
                return;
            }

            if (shouldSkipForBBox(node)) {
                return;
            }

            try {
                var box = node.getBBox();
                if (!isFinite(box.x) || !isFinite(box.y) || !isFinite(box.width) || !isFinite(box.height)) {
                    return;
                }

                var ctm = typeof node.getCTM === 'function' ? node.getCTM() : null;
                if (!ctm) {
                    minX = Math.min(minX, box.x);
                    minY = Math.min(minY, box.y);
                    maxX = Math.max(maxX, box.x + box.width);
                    maxY = Math.max(maxY, box.y + box.height);
                    return;
                }

                var corners = [
                    {x: box.x, y: box.y},
                    {x: box.x + box.width, y: box.y},
                    {x: box.x, y: box.y + box.height},
                    {x: box.x + box.width, y: box.y + box.height}
                ];

                corners.forEach(function (corner) {
                    var tx = (ctm.a * corner.x) + (ctm.c * corner.y) + ctm.e;
                    var ty = (ctm.b * corner.x) + (ctm.d * corner.y) + ctm.f;

                    if (!isFinite(tx) || !isFinite(ty)) {
                        return;
                    }

                    minX = Math.min(minX, tx);
                    minY = Math.min(minY, ty);
                    maxX = Math.max(maxX, tx);
                    maxY = Math.max(maxY, ty);
                });
            } catch (error) {
                // ignore nodes that cannot calculate a bounding box
            }
        });

        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return null;
        }

        var width = maxX - minX;
        var height = maxY - minY;

        if (width <= 0 || height <= 0) {
            return null;
        }

        return {
            x: minX,
            y: minY,
            width: width,
            height: height
        };
    }

    function parseViewBoxValue(viewBoxValue) {
        if (typeof viewBoxValue !== 'string') {
            return null;
        }

        var parts = viewBoxValue.trim().split(/\s+|,/).map(function (part) {
            return parseFloat(part);
        });

        if (parts.length !== 4 || parts.some(function (num) { return !isFinite(num); })) {
            return null;
        }

        if (parts[2] <= 0 || parts[3] <= 0) {
            return null;
        }

        return {
            x: parts[0],
            y: parts[1],
            width: parts[2],
            height: parts[3]
        };
    }

    function getRenderDimensions(svgElement) {
        var viewBox = parseViewBoxValue(svgElement.getAttribute('viewBox') || '');
        var width = parseLength(svgElement.getAttribute('width') || '');
        var height = parseLength(svgElement.getAttribute('height') || '');

        if (viewBox) {
            if (!(isFinite(width) && width > 0)) {
                width = viewBox.width;
            }
            if (!(isFinite(height) && height > 0)) {
                height = viewBox.height;
            }
        }

        if (!(isFinite(width) && width > 0) || !(isFinite(height) && height > 0)) {
            return null;
        }

        return {
            width: width,
            height: height,
            viewBox: viewBox
        };
    }

    function getRenderedBoundingBox(svgElement, previewElement) {
        return new Promise(function (resolve) {
            var dimensions = getRenderDimensions(svgElement);
            if (!dimensions) {
                resolve(null);
                return;
            }

            var scale = 4;
            var maxPixels = 4096;
            var renderWidth = Math.max(1, Math.round(dimensions.width));
            var renderHeight = Math.max(1, Math.round(dimensions.height));

            var canvasWidth = Math.min(maxPixels, Math.max(1, Math.round(renderWidth * scale)));
            var canvasHeight = Math.min(maxPixels, Math.max(1, Math.round(renderHeight * scale)));

            var serializer = new XMLSerializer();
            var serialized = serializer.serializeToString(svgElement);
            var blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var image = new Image();

            image.onload = function () {
                try {
                    var canvas = document.createElement('canvas');
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;

                    var context = canvas.getContext('2d');
                    if (!context) {
                        resolve(null);
                        return;
                    }

                    context.clearRect(0, 0, canvasWidth, canvasHeight);
                    context.drawImage(image, 0, 0, canvasWidth, canvasHeight);

                    var imageData = context.getImageData(0, 0, canvasWidth, canvasHeight).data;
                    var minX = canvasWidth;
                    var minY = canvasHeight;
                    var maxX = -1;
                    var maxY = -1;

                    for (var y = 0; y < canvasHeight; y++) {
                        for (var x = 0; x < canvasWidth; x++) {
                            var index = (y * canvasWidth + x) * 4;
                            var alpha = imageData[index + 3];

                            if (alpha > 8) {
                                minX = Math.min(minX, x);
                                minY = Math.min(minY, y);
                                maxX = Math.max(maxX, x);
                                maxY = Math.max(maxY, y);
                            }
                        }
                    }

                    if (maxX < minX || maxY < minY) {
                        resolve(null);
                        return;
                    }

                    var refViewBox = dimensions.viewBox || {
                        x: 0,
                        y: 0,
                        width: dimensions.width,
                        height: dimensions.height
                    };

                    var x1 = refViewBox.x + (minX / canvasWidth) * refViewBox.width;
                    var y1 = refViewBox.y + (minY / canvasHeight) * refViewBox.height;
                    var x2 = refViewBox.x + ((maxX + 1) / canvasWidth) * refViewBox.width;
                    var y2 = refViewBox.y + ((maxY + 1) / canvasHeight) * refViewBox.height;

                    resolve({
                        x: x1,
                        y: y1,
                        width: Math.max(0, x2 - x1),
                        height: Math.max(0, y2 - y1)
                    });
                } catch (error) {
                    resolve(null);
                } finally {
                    URL.revokeObjectURL(url);
                }
            };

            image.onerror = function () {
                URL.revokeObjectURL(url);
                resolve(null);
            };

            // Ensure deterministic dimensions for raster analysis.
            image.src = url;
        });
    }

    function serializeSvg(svgElement) {
        var serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    }

    function minifySvgString(svgContent) {
        return svgContent
            .replace(/>\s+</g, '><')
            .replace(/\s+\/>/g, '/>')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    function cleanupSvgForSave(svgElement) {
        var style = svgElement.getAttribute('style');
        if (!style) {
            return;
        }

        var cleaned = style
            .replace(/(?:^|;)\s*width\s*:[^;]*/gi, '')
            .replace(/(?:^|;)\s*height\s*:[^;]*/gi, '')
            .replace(/(?:^|;)\s*max-width\s*:[^;]*/gi, '')
            .replace(/(?:^|;)\s*max-height\s*:[^;]*/gi, '')
            .replace(/(?:^|;)\s*display\s*:[^;]*/gi, '')
            .replace(/;;+/g, ';')
            .replace(/^\s*;|;\s*$/g, '')
            .trim();

        if ('' === cleaned) {
            svgElement.removeAttribute('style');
            return;
        }

        svgElement.setAttribute('style', cleaned);
    }

    function ensurePreviewViewBox(svg) {
        if (!svg.hasAttribute('viewBox')) {
            var width = parseLength(svg.getAttribute('width') || '');
            var height = parseLength(svg.getAttribute('height') || '');
            if (null !== width && null !== height && width > 0 && height > 0) {
                svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            }
        }

        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    function init() {
        var editor = document.getElementById('svgcrop-editor');
        var preview = document.getElementById('svgcrop-preview');
        var optimizeButton = document.getElementById('svgcrop-optimize-button');
        var trimButton = document.getElementById('svgcrop-trim-button');
        var paddingInput = document.getElementById('svgcrop-trim-padding');
        var status = document.getElementById('svgcrop-status');
        var createNewCheckbox = document.getElementById('svgcrop-create-new-image');
        var newFileOptions = document.getElementById('svgcrop-new-file-options');
        var openSvgEditButton = document.getElementById('svgcrop-open-svg-edit');
        var pendingSvgEditReturnKey = null;
        var svgEditOverlay = null;
        var svgEditOverlayFrame = null;

        if (!editor || !preview || !optimizeButton || !trimButton || !paddingInput || !status) {
            return;
        }

        if (!document.getElementById('svgcrop-preview-style')) {
            var styleNode = document.createElement('style');
            styleNode.id = 'svgcrop-preview-style';
            styleNode.textContent = '#svgcrop-preview > svg{width:100%;height:100%;max-width:100%;max-height:100%;display:block;}';
            document.head.appendChild(styleNode);
        }

        function getPaddingValue() {
            var padding = parseFloat(paddingInput.value || '0');
            if (!isFinite(padding) || padding < 0) {
                return 0;
            }

            return padding;
        }

        function setStatus(text, isError) {
            status.textContent = text;
            status.style.color = isError ? '#a94442' : '#3c763d';
        }

        function applyReturnedSvg(svgContent) {
            var content = String(svgContent || '').trim();
            if (!content || content.indexOf('<svg') === -1) {
                return false;
            }

            editor.value = content;
            renderPreview();
            setStatus('Bearbeitetes SVG aus SVG-Edit übernommen.', false);
            return true;
        }

        function pullSvgEditReturnFromStorage() {
            if (!pendingSvgEditReturnKey) {
                return;
            }

            var content;
            try {
                content = window.localStorage.getItem(pendingSvgEditReturnKey);
                if (!content) {
                    return;
                }
                window.localStorage.removeItem(pendingSvgEditReturnKey);
            } catch (error) {
                return;
            }

            if (applyReturnedSvg(content)) {
                pendingSvgEditReturnKey = null;
            }
        }

        function consumeSvgEditReturnFromUrl() {
            var url;
            try {
                url = new URL(window.location.href);
            } catch (error) {
                return;
            }

            var returned = url.searchParams.get('svgcropReturned');
            var returnKey = url.searchParams.get('svgcropReturnKey');
            if (returned !== '1' || !returnKey) {
                return;
            }

            pendingSvgEditReturnKey = returnKey;
            pullSvgEditReturnFromStorage();

            url.searchParams.delete('svgcropReturned');
            url.searchParams.delete('svgcropReturnKey');
            try {
                window.history.replaceState({}, '', url.toString());
            } catch (error) {
                // ignore history API failures
            }
        }

        function ensureSvgEditOverlay() {
            if (svgEditOverlay && svgEditOverlayFrame) {
                return;
            }

            svgEditOverlay = document.createElement('div');
            svgEditOverlay.id = 'svgcrop-svgedit-overlay';
            svgEditOverlay.style.position = 'fixed';
            svgEditOverlay.style.inset = '0';
            svgEditOverlay.style.background = 'rgba(0, 0, 0, 0.55)';
            svgEditOverlay.style.zIndex = '20000';
            svgEditOverlay.style.display = 'none';
            svgEditOverlay.style.padding = '20px';

            var panel = document.createElement('div');
            panel.style.position = 'relative';
            panel.style.width = '100%';
            panel.style.height = '100%';
            panel.style.background = '#fff';
            panel.style.borderRadius = '8px';
            panel.style.overflow = 'hidden';
            panel.style.boxShadow = '0 18px 50px rgba(0, 0, 0, 0.35)';
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';

            var toolbar = document.createElement('div');
            toolbar.style.height = '48px';
            toolbar.style.flex = '0 0 48px';
            toolbar.style.display = 'flex';
            toolbar.style.alignItems = 'center';
            toolbar.style.justifyContent = 'flex-end';
            toolbar.style.gap = '10px';
            toolbar.style.padding = '8px 12px';
            toolbar.style.background = '#f7f7f7';
            toolbar.style.borderBottom = '1px solid #e1e1e1';

            var applyButton = document.createElement('button');
            applyButton.type = 'button';
            applyButton.textContent = 'Uebernehmen in SVG-Crop';
            applyButton.className = 'btn btn-primary';
            applyButton.addEventListener('click', function () {
                if (!pendingSvgEditReturnKey || !svgEditOverlayFrame || !svgEditOverlayFrame.contentWindow) {
                    setStatus('Kein Rueckkanal zu SVG-Edit verfuegbar.', true);
                    return;
                }

                svgEditOverlayFrame.contentWindow.postMessage({
                    type: 'svgcrop:host:request-return',
                    key: pendingSvgEditReturnKey
                }, window.location.origin);
            });

            var closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.textContent = 'Schliessen';
            closeButton.setAttribute('aria-label', 'SVG-Edit schließen');
            closeButton.className = 'btn btn-default';
            closeButton.addEventListener('click', function () {
                svgEditOverlay.style.display = 'none';
            });

            svgEditOverlayFrame = document.createElement('iframe');
            svgEditOverlayFrame.id = 'svgcrop-svgedit-iframe';
            svgEditOverlayFrame.setAttribute('title', 'SVG-Edit');
            svgEditOverlayFrame.style.flex = '1 1 auto';
            svgEditOverlayFrame.style.minHeight = '0';
            svgEditOverlayFrame.style.width = '100%';
            svgEditOverlayFrame.style.border = '0';

            toolbar.appendChild(applyButton);
            toolbar.appendChild(closeButton);
            panel.appendChild(toolbar);
            panel.appendChild(svgEditOverlayFrame);
            svgEditOverlay.appendChild(panel);
            document.body.appendChild(svgEditOverlay);
        }

        function renderPreview() {
            preview.innerHTML = editor.value;
            var svg = preview.querySelector('svg');
            if (!svg) {
                setStatus('Kein gültiges SVG gefunden.', true);
                return null;
            }

            ensurePreviewViewBox(svg);
            setStatus('', false);
            return svg;
        }

        optimizeButton.addEventListener('click', function () {
            var svg = renderPreview();
            if (!svg) {
                return;
            }

            optimizeSvg(svg);
            cleanupSvgForSave(svg);
            editor.value = minifySvgString(serializeSvg(svg));
            renderPreview();
            setStatus('SVG wurde für das Web optimiert und minifiziert.', false);
        });

        function openInSvgEdit() {
            if (!openSvgEditButton) {
                return;
            }

            var endpoint = String(openSvgEditButton.getAttribute('data-svgedit-url') || '').trim();
            if (!endpoint) {
                setStatus('SVG-Edit URL ist nicht konfiguriert.', true);
                return;
            }

            var parsedEndpoint;
            try {
                parsedEndpoint = new URL(endpoint, window.location.origin);
            } catch (error) {
                setStatus('SVG-Edit URL ist ungültig.', true);
                return;
            }

            if (parsedEndpoint.protocol !== 'http:' && parsedEndpoint.protocol !== 'https:') {
                setStatus('SVG-Edit URL muss mit http oder https beginnen.', true);
                return;
            }

            var svgContent = String(editor.value || '').trim();
            if (!svgContent || svgContent.indexOf('<svg') === -1) {
                setStatus('Kein gültiges SVG zum Öffnen in SVG-Edit vorhanden.', true);
                return;
            }

            var isSameOrigin = parsedEndpoint.origin === window.location.origin;
            if (isSameOrigin) {
                try {
                    var returnKey = 'svgcrop:return:' + Date.now() + ':' + Math.random().toString(36).slice(2);
                    var storageKey = 'svgcrop:svgedit:' + Date.now() + ':' + Math.random().toString(36).slice(2);

                    window.localStorage.setItem(storageKey, svgContent);
                    window.localStorage.setItem('svgcrop:svgedit:latest', svgContent);
                    window.localStorage.removeItem(returnKey);

                    parsedEndpoint.searchParams.set('svgcropStorageKey', storageKey);
                    parsedEndpoint.searchParams.set('svgcropReturnKey', returnKey);
                    parsedEndpoint.searchParams.set('svgcropEmbed', '1');
                    parsedEndpoint.searchParams.set('svgcropTs', String(Date.now()));

                    pendingSvgEditReturnKey = returnKey;
                } catch (error) {
                    setStatus('SVG konnte nicht für SVG-Edit zwischengespeichert werden.', true);
                    return;
                }
            } else {
                // Fallback for cross-origin URLs where shared localStorage is not available.
                var dataUri = 'data:image/svg+xml;utf8,' + svgContent;
                parsedEndpoint.searchParams.set('source', dataUri);
            }

            if (isSameOrigin) {
                ensureSvgEditOverlay();
                svgEditOverlayFrame.src = parsedEndpoint.toString();
                svgEditOverlay.style.display = 'block';
                setStatus('SVG-Edit wurde als Overlay geöffnet.', false);
                return;
            }

            var opened = window.open(parsedEndpoint.toString(), '_blank');
            if (!opened) {
                setStatus('SVG-Edit konnte nicht geöffnet werden (Popup-Blocker?).', true);
                return;
            }

            setStatus('SVG-Edit wurde in einem neuen Tab geöffnet.', false);
        }

        function toggleNewFileOptions() {
            if (!createNewCheckbox || !newFileOptions) {
                return;
            }

            newFileOptions.style.display = createNewCheckbox.checked ? '' : 'none';
        }

        trimButton.addEventListener('click', async function () {
            var svg = renderPreview();
            if (!svg) {
                return;
            }

            setStatus('Sichtbare Fläche wird analysiert...', false);

            var bbox = await getRenderedBoundingBox(svg, preview);
            if (!bbox) {
                bbox = getBoundingBox(svg);
            }

            if (!bbox) {
                setStatus('Der SVG-Inhalt konnte nicht zugeschnitten werden.', true);
                return;
            }

            var padding = getPaddingValue();

            var x = bbox.x - padding;
            var y = bbox.y - padding;
            var width = bbox.width + (padding * 2);
            var height = bbox.height + (padding * 2);

            svg.setAttribute('viewBox', x + ' ' + y + ' ' + width + ' ' + height);
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            cleanupSvgForSave(svg);

            editor.value = minifySvgString(serializeSvg(svg));
            renderPreview();
            setStatus('Leerraum wurde entfernt (ViewBox angepasst).', false);
        });

        if (openSvgEditButton) {
            consumeSvgEditReturnFromUrl();
            openSvgEditButton.addEventListener('click', openInSvgEdit);
            window.addEventListener('focus', pullSvgEditReturnFromStorage);
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible') {
                    pullSvgEditReturnFromStorage();
                }
            });

            window.addEventListener('message', function (event) {
                if (event.origin !== window.location.origin || !event.data || event.data.type !== 'svgcrop:svgedit:return') {
                    return;
                }

                if (pendingSvgEditReturnKey && event.data.key && event.data.key !== pendingSvgEditReturnKey) {
                    return;
                }

                pullSvgEditReturnFromStorage();

                if (svgEditOverlay) {
                    svgEditOverlay.style.display = 'none';
                }
            });
        }

        if (createNewCheckbox) {
            createNewCheckbox.addEventListener('change', toggleNewFileOptions);
            toggleNewFileOptions();
        }

        renderPreview();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
