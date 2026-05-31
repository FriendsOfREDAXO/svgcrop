<?php

const SVGCROP_POOL_MEDIA = 'mediapool/media';

$csrf = rex_csrf_token::factory('svgcrop_mediapool');
$user = rex::getUser();
$urlParameter = [
    'file_id' => rex_request::request('file_id', 'integer'),
    'rex_file_category' => rex_request::request('rex_file_category', 'integer'),
];

$body = '';
$title = '';
$class = 'edit';

$backLink = '<a class="btn btn-default" href="' . rex_url::backendPage(SVGCROP_POOL_MEDIA, $urlParameter, false) . '"><span class="fa fa-arrow-left" aria-hidden="true"></span> <span>' . rex_i18n::msg('svgcrop_back_to_media') . '</span></a>';
$back = '<div class="cropper-page-options">' . $backLink . '</div>';

if (!$user instanceof rex_user || !$user->hasPerm('svgcrop[]')) {
    rex_response::sendRedirect(rex_url::backendPage(SVGCROP_POOL_MEDIA, $urlParameter, false));
}

try {
    $mediaName = rex_request::request('media_name', 'string', '');
    if ('' === $mediaName) {
        throw new rex_exception(rex_i18n::msg('svgcrop_error_missing_media_name'));
    }

    $media = rex_media::get($mediaName);
    if (!$media instanceof rex_media) {
        throw new rex_exception(rex_i18n::msg('svgcrop_error_media_not_found'));
    }

    if (!svgcrop_is_supported_media($media->getFileName())) {
        throw new rex_exception(rex_i18n::msg('svgcrop_error_unsupported_format'));
    }

    if (1 === rex_request::request('btn_abort', 'integer', 0)) {
        rex_response::sendRedirect(rex_url::backendPage(SVGCROP_POOL_MEDIA, $urlParameter, false));
    }

    if (1 === rex_request::request('btn_save', 'integer', 0)) {
        if (!$csrf->isValid()) {
            throw new rex_exception(rex_i18n::msg('svgcrop_error_csrf'));
        }

        $svgContent = rex_request::post('svg_content', 'string', '');
        if ('' === trim($svgContent) || false === strpos($svgContent, '<svg')) {
            throw new rex_exception(rex_i18n::msg('svgcrop_error_invalid_svg'));
        }

        $saveAsNew = rex_request::post('create_new_image', 'integer', 0) === 1;
        if (!$user->hasPerm('svgcrop[overwrite]')) {
            $saveAsNew = true;
        }

        $targetFilename = $media->getFileName();
        $targetCategory = (int) rex_request::post('rex_file_category', 'integer', $media->getCategoryId());

        if ($saveAsNew) {
            $requestedName = rex_request::post('new_file_name', 'string', pathinfo($media->getFileName(), PATHINFO_FILENAME));
            $targetFilename = rex_mediapool_filename($requestedName . '.svg', true);
        }

        $targetPath = rex_path::media($targetFilename);
        $putResult = rex_file::put($targetPath, $svgContent);
        if (false === $putResult) {
            throw new rex_exception(rex_i18n::msg('svgcrop_error_save_failed'));
        }

        if ($saveAsNew) {
            $sync = rex_mediapool_syncFile(
                $targetFilename,
                $targetCategory,
                $media->getTitle(),
                filesize($targetPath),
                rex_file::mimeType($targetPath),
                (string) $user->getValue('login')
            );

            if (!(isset($sync['ok']) && 1 === (int) $sync['ok'])) {
                rex_file::delete($targetPath);
                throw new rex_exception(rex_i18n::msg('svgcrop_error_create_failed'));
            }

            $targetMedia = rex_media::get($targetFilename);
            if ($targetMedia instanceof rex_media) {
                $urlParameter['file_id'] = $targetMedia->getId();
            }
            $urlParameter['svgcrop_msg'] = 'svgcrop_successful_created';
        } else {
            rex_media_cache::delete($targetFilename);
            $urlParameter['svgcrop_msg'] = 'svgcrop_successful_updated';
        }

        if (rex_post('opener_input_field', 'string')) {
            $urlParameter['opener_input_field'] = rex_post('opener_input_field', 'string');
        }

        rex_response::sendRedirect(rex_url::backendPage(SVGCROP_POOL_MEDIA, $urlParameter, false));
    }

    $msg = rex_request::request('svgcrop_msg', 'string', null);
    if (is_string($msg) && '' !== $msg) {
        echo rex_view::success(rex_i18n::msg($msg));
    }

    $svgPath = rex_path::media($media->getFileName());
    if (!is_file($svgPath)) {
        throw new rex_exception(rex_i18n::msg('svgcrop_error_media_file_not_found'));
    }

    $svgContent = rex_file::get($svgPath);
    if (!is_string($svgContent) || '' === $svgContent) {
        throw new rex_exception(rex_i18n::msg('svgcrop_error_invalid_svg'));
    }

    $title = sprintf(rex_i18n::msg('svgcrop_media_crop_title'), pathinfo($media->getFileName(), PATHINFO_FILENAME));

    $canOverwrite = $user->hasPerm('svgcrop[overwrite]');
    $fileBaseName = pathinfo($media->getFileName(), PATHINFO_FILENAME);

    $catsSel = new rex_media_category_select();
    $catsSel->setStyle('class="form-control selectpicker"');
    $catsSel->setAttribute('data-live-search', 'true');
    $catsSel->setSize(1);
    $catsSel->setName('rex_file_category');
    $catsSel->setId('rex-mediapool-category');
    $catsSel->addOption(rex_i18n::msg('pool_kats_no'), '0');
    $catsSel->setSelected($media->getCategoryId());

    $createNewCheckbox = '<label class="checkbox-inline checbox-switch switch-primary">'
        . '<input type="checkbox" name="create_new_image" id="svgcrop-create-new-image" value="1" checked="checked" ' . ($canOverwrite ? '' : 'disabled="disabled"') . ' />'
        . '<span></span>' . rex_i18n::msg('svgcrop_save_as_new') . '</label>';

    if (!$canOverwrite) {
        $createNewCheckbox .= '<input type="hidden" name="create_new_image" value="1" />';
    }

    $fragment = new rex_fragment();
    $fragment->setVar('elements', [[
        'label' => '<label>' . rex_i18n::msg('svgcrop_save_options') . '</label>',
        'field' => $createNewCheckbox,
    ]], false);
    $saveOptions = $fragment->parse('core/form/form.php');

    $fragment = new rex_fragment();
    $fragment->setVar('elements', [[
        'label' => '<label for="svgcrop-new-file-name">' . rex_i18n::msg('pool_filename') . '</label>',
        'field' => '<div class="input-group">'
            . '<input class="form-control" id="svgcrop-new-file-name" type="text" name="new_file_name" value="' . rex_escape($fileBaseName) . '" />'
            . '<span class="input-group-addon">.svg</span>'
            . '</div>',
    ]], false);
    $filenameForm = $fragment->parse('core/form/form.php');

    $categoryForm = '<dl class="rex-form-group form-group">'
        . '<dt><label for="rex-mediapool-category">' . rex_i18n::msg('pool_file_category') . '</label></dt>'
        . '<dd>' . $catsSel->get() . '</dd>'
        . '</dl>';

    $editorForm = '<textarea id="svgcrop-editor" name="svg_content" style="display:none" aria-hidden="true" tabindex="-1">' . rex_escape($svgContent) . '</textarea>'
        . '<p class="help-block">' . rex_i18n::msg('svgcrop_editor_notice') . '</p>';

    $previewPanel = '<div class="panel panel-default">'
        . '<div class="panel-heading">' . rex_i18n::msg('svgcrop_preview_title') . '</div>'
        . '<div class="panel-body">'
        . '<div class="form-inline" style="margin-bottom:10px">'
        . '<button type="button" class="btn btn-default" id="svgcrop-optimize-button">' . rex_i18n::msg('svgcrop_optimize_button') . '</button> '
        . '<button type="button" class="btn btn-default" id="svgcrop-trim-button">' . rex_i18n::msg('svgcrop_trim_button') . '</button> '
        . '<label for="svgcrop-trim-padding" style="margin-left:8px">' . rex_i18n::msg('svgcrop_trim_padding') . '</label> '
        . '<input type="number" class="form-control" id="svgcrop-trim-padding" value="0" step="0.5" style="width:90px" />'
        . '</div>'
        . '<div id="svgcrop-preview" style="height:50vh;max-height:50vh;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid #d7d7d7;padding:10px;background:#fff"></div>'
        . '<p class="help-block" id="svgcrop-status"></p>'
        . '</div></div>';

    $buttonsFragment = new rex_fragment();
    $buttonsFragment->setVar('elements', [
        ['field' => '<button class="btn btn-apply rex-form-aligned" type="submit" value="1" name="btn_save">' . rex_i18n::msg('form_save') . '</button>'],
        ['field' => '<button class="btn btn-abort" type="submit" value="1" name="btn_abort">' . rex_i18n::msg('form_abort') . '</button>'],
    ], false);
    $buttons = $buttonsFragment->parse('core/form/submit.php');

    $body = '<form action="' . rex_url::currentBackendPage() . '" method="post" data-pjax="false">'
        . $csrf->getHiddenField()
        . '<input type="hidden" name="file_id" value="' . rex_request::request('file_id', 'integer') . '" />'
        . '<input type="hidden" name="media_name" value="' . rex_escape($media->getFileName()) . '" />'
        . '<input type="hidden" name="opener_input_field" value="' . rex_request::request('opener_input_field', 'string') . '" />'
        . $saveOptions
        . '<div id="svgcrop-new-file-options">' . $filenameForm . $categoryForm . '</div>'
        . $previewPanel
        . $editorForm
        . $buttons
        . '</form>';
} catch (rex_exception $exception) {
    rex_logger::logException($exception);
    $body = rex_view::error($exception->getMessage());
}

$fragment = new rex_fragment();
$fragment->setVar('class', $class, false);
$fragment->setVar('title', $title, false);
$fragment->setVar('options', $back, false);
$fragment->setVar('body', $body, false);
echo $fragment->parse('core/page/section.php');
