<?php

/** @var rex_addon $this */

$user = rex::getUser();

if (rex::isBackend() && $user instanceof rex_user) {
    rex_perm::register('svgcrop[]');
    rex_perm::register('svgcrop[overwrite]');
    rex_perm::register('svgcrop[svg_edit]');
}

if (!function_exists('svgcrop_is_supported_media')) {
    function svgcrop_is_supported_media(string $filename): bool
    {
        if ('' === $filename) {
            return false;
        }

        return 'svg' === strtolower(rex_file::extension($filename));
    }
}

if (!function_exists('svgcrop_render_feedback_once')) {
    function svgcrop_render_feedback_once(): void
    {
        static $wasRendered = false;
        if ($wasRendered) {
            return;
        }

        $msg = rex_request::request('svgcrop_msg', 'string', null);
        $hasError = rex_request::request('svgcrop_error', 'boolean', false);
        if (is_string($msg) && '' !== $msg) {
            echo $hasError ? rex_view::error(rex_i18n::msg($msg)) : rex_view::success(rex_i18n::msg($msg));
            $wasRendered = true;
        }
    }
}

if (rex::isBackend() && $user instanceof rex_user && $user->hasPerm('svgcrop[]')) {
    $addon = $this;
    $assetVersion = static function (string $assetPath) use ($addon): string {
        $fullPath = $addon->getPath('assets/' . $assetPath);
        $mtime = @filemtime($fullPath);

        if (false === $mtime) {
            return '?v=' . rawurlencode((string) $addon->getVersion());
        }

        return '?v=' . rawurlencode((string) $mtime);
    };

    if ('svgcrop' === rex_be_controller::getCurrentPagePart(2)) {
        rex_view::addJsFile($this->getAssetsUrl('js/rex_svgcrop.js') . $assetVersion('js/rex_svgcrop.js'));
    }

    rex_extension::register('MEDIA_FORM_EDIT', static function (rex_extension_point $ep): ?string {
        /** @var rex_sql $media */
        $media = $ep->getParam('media');

        svgcrop_render_feedback_once();

        $filename = (string) $media->getValue('filename');
        $rexMedia = '' !== $filename ? rex_media::get($filename) : null;

        if (!$rexMedia instanceof rex_media || !svgcrop_is_supported_media($filename)) {
            return null;
        }

        $linkParams = [
            'rex_file_category' => rex_request::get('rex_file_category', 'integer', 0),
            'file_id' => $ep->getParam('id'),
            'media_name' => $filename,
        ];

        if (rex_get('opener_input_field', 'string')) {
            $linkParams['opener_input_field'] = rex_get('opener_input_field', 'string');
        }

        $link = rex_url::backendPage('mediapool/svgcrop', $linkParams, true);

        $fragment = new rex_fragment();
        $fragment->setVar('elements', [[
            'label' => '<label>' . rex_i18n::msg('svgcrop_media_edit_label') . '</label>',
            'field' => '<a class="btn btn-primary" href="' . $link . '"><span>' . rex_i18n::msg('svgcrop_media_edit_link') . '</span> <i class="fa fa-crop"></i></a>',
        ]], false);

        return $fragment->parse('core/form/form.php');
    });

    rex_extension::register('MEDIA_LIST_FUNCTIONS', static function (rex_extension_point $ep): string {
        $subject = (string) $ep->getSubject();

        svgcrop_render_feedback_once();

        if ((int) rex_config::get('svgcrop', 'show_edit_in_list', 1) !== 1) {
            return $subject;
        }

        /** @var rex_sql $media */
        $media = $ep->getParam('media');
        $filename = (string) $media->getValue('name');
        $rexMedia = '' !== $filename ? rex_media::get($filename) : null;

        if (!$rexMedia instanceof rex_media || !svgcrop_is_supported_media($filename)) {
            return $subject;
        }

        $linkParams = [
            'rex_file_category' => rex_request::get('rex_file_category', 'integer', 0),
            'file_id' => $ep->getParam('id'),
            'media_name' => $filename,
        ];

        if (rex_get('opener_input_field', 'string')) {
            $linkParams['opener_input_field'] = rex_get('opener_input_field', 'string');
        }

        $link = rex_url::backendPage('mediapool/svgcrop', $linkParams, true);

        return '<a href="' . $link . '" class="svgcrop-media-edit-link"><span>' . rex_i18n::msg('svgcrop_media_edit_link') . '</span> <i class="fa fa-crop"></i></a>' . $subject;
    });
}
