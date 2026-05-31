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
        var nodes = svgElement.querySelectorAll('*');
        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;

        nodes.forEach(function (node) {
            if (typeof node.getBBox !== 'function') {
                return;
            }

            try {
                var box = node.getBBox();
                if (!isFinite(box.x) || !isFinite(box.y) || !isFinite(box.width) || !isFinite(box.height)) {
                    return;
                }

                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.width);
                maxY = Math.max(maxY, box.y + box.height);
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

        if (!editor || !preview || !optimizeButton || !trimButton || !paddingInput || !status) {
            return;
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

        function renderPreview() {
            preview.innerHTML = editor.value;
            var svg = preview.querySelector('svg');
            if (!svg) {
                setStatus('Kein gültiges SVG gefunden.', true);
                return null;
            }

            ensurePreviewViewBox(svg);

            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.maxWidth = '100%';
            svg.style.maxHeight = '100%';
            svg.style.display = 'block';
            setStatus('', false);
            return svg;
        }

        optimizeButton.addEventListener('click', function () {
            var svg = renderPreview();
            if (!svg) {
                return;
            }

            optimizeSvg(svg);
            editor.value = minifySvgString(serializeSvg(svg));
            renderPreview();
            setStatus('SVG wurde für das Web optimiert und minifiziert.', false);
        });

        function toggleNewFileOptions() {
            if (!createNewCheckbox || !newFileOptions) {
                return;
            }

            newFileOptions.style.display = createNewCheckbox.checked ? '' : 'none';
        }

        trimButton.addEventListener('click', function () {
            var svg = renderPreview();
            if (!svg) {
                return;
            }

            var bbox = getBoundingBox(svg);
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

            editor.value = minifySvgString(serializeSvg(svg));
            renderPreview();
            setStatus('Leerraum wurde entfernt (ViewBox angepasst).', false);
        });

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
