<?php

const SVGCROP_POOL_MEDIA = 'mediapool/media';

$user = rex::getUser();
if (!$user instanceof rex_user || !svgcrop_can_access_settings($user)) {
    rex_response::sendRedirect(rex_url::backendPage(SVGCROP_POOL_MEDIA, [], false));
}

$csrf = rex_csrf_token::factory('svgcrop_settings');
$addon = rex_addon::get('svgcrop');

$defaultRatioProfilesJson = (string) $addon->getConfig('ratio_profiles_json', '[{"key":"logo_square","label":"Logo 1:1","width":1,"height":1,"mode":"contain","anchor":"center"}]');

$normalizeProfiles = static function (mixed $decoded): array {
    if (!is_array($decoded)) {
        return [];
    }

    $profiles = [];
    foreach ($decoded as $item) {
        if (!is_array($item)) {
            continue;
        }

        $label = trim((string) ($item['label'] ?? ''));
        $width = (float) ($item['width'] ?? 0);
        $height = (float) ($item['height'] ?? 0);
        if ('' === $label || $width <= 0 || $height <= 0) {
            continue;
        }

        $mode = strtolower(trim((string) ($item['mode'] ?? 'contain')));
        if ('cover' !== $mode) {
            $mode = 'contain';
        }

        $anchor = strtolower(trim((string) ($item['anchor'] ?? 'center')));
        $allowedAnchors = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
        if (!in_array($anchor, $allowedAnchors, true)) {
            $anchor = 'center';
        }

        $key = trim((string) ($item['key'] ?? ''));
        if ('' === $key) {
            $key = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $label) ?? 'ratio');
        }

        $profiles[] = [
            'key' => $key,
            'label' => $label,
            'width' => $width,
            'height' => $height,
            'mode' => $mode,
            'anchor' => $anchor,
        ];
    }

    return $profiles;
};

$showEditInList = (int) $addon->getConfig('show_edit_in_list', 1) === 1;
$svgEditUrl = (string) $addon->getConfig('svg_edit_url', '/assets/addons/svgcrop/vendor/svgedit/index.html');
$defaultTrimPadding = (string) $addon->getConfig('default_trim_padding', '0');
$ratioProfilesJson = $defaultRatioProfilesJson;

if (1 === rex_request::post('btn_save', 'int', 0)) {
    if (!$csrf->isValid()) {
        echo rex_view::error(rex_i18n::msg('svgcrop_error_csrf'));
    } else {
        $showEditInList = 1 === rex_request::post('show_edit_in_list', 'int', 0);
        $svgEditUrl = trim(rex_request::post('svg_edit_url', 'string', '/assets/addons/svgcrop/vendor/svgedit/index.html'));
        $defaultTrimPadding = trim(rex_request::post('default_trim_padding', 'string', '0'));
        $ratioProfilesJson = trim(rex_request::post('ratio_profiles_json', 'string', $defaultRatioProfilesJson));

        if ('' === $svgEditUrl) {
            $svgEditUrl = '/assets/addons/svgcrop/vendor/svgedit/index.html';
        }

        $paddingFloat = (float) str_replace(',', '.', $defaultTrimPadding);
        if (!is_finite($paddingFloat) || $paddingFloat < 0) {
            $paddingFloat = 0.0;
        }

        $decodedProfiles = json_decode($ratioProfilesJson, true);
        if (JSON_ERROR_NONE !== json_last_error()) {
            echo rex_view::error(rex_i18n::msg('svgcrop_settings_error_invalid_ratio_json'));
        } else {
            $profiles = $normalizeProfiles($decodedProfiles);
            if ([] === $profiles) {
                echo rex_view::error(rex_i18n::msg('svgcrop_settings_error_no_valid_ratio_profiles'));
            } else {
                rex_config::set('svgcrop', 'show_edit_in_list', $showEditInList ? 1 : 0);
                rex_config::set('svgcrop', 'svg_edit_url', $svgEditUrl);
                rex_config::set('svgcrop', 'default_trim_padding', $paddingFloat);
                rex_config::set('svgcrop', 'ratio_profiles_json', json_encode($profiles, JSON_UNESCAPED_SLASHES));

                echo rex_view::success(rex_i18n::msg('svgcrop_settings_saved'));
                $ratioProfilesJson = json_encode($profiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            }
        }
    }
}

$backLink = '<a class="btn btn-default" href="' . rex_url::backendPage(SVGCROP_POOL_MEDIA, ['rex_file_category' => rex_request::request('rex_file_category', 'integer', 0)], false) . '"><span class="fa fa-arrow-left" aria-hidden="true"></span> <span>' . rex_i18n::msg('svgcrop_back_to_media') . '</span></a>';
$options = '<div class="cropper-page-options">' . $backLink . '</div>';

$showEditField = '<label class="checkbox-inline checbox-switch switch-primary">'
    . '<input type="checkbox" name="show_edit_in_list" value="1"' . ($showEditInList ? ' checked="checked"' : '') . ' />'
    . '<span></span>' . rex_i18n::msg('svgcrop_settings_show_edit_in_list')
    . '</label>';

$fields = [];
$fields[] = [
    'label' => '<label>' . rex_i18n::msg('svgcrop_settings_show_edit_in_list') . '</label>',
    'field' => $showEditField,
];
$fields[] = [
    'label' => '<label for="svgcrop-settings-svg-edit-url">' . rex_i18n::msg('svgcrop_settings_svg_edit_url') . '</label>',
    'field' => '<input id="svgcrop-settings-svg-edit-url" class="form-control" type="text" name="svg_edit_url" value="' . rex_escape($svgEditUrl) . '" />',
];
$fields[] = [
    'label' => '<label for="svgcrop-settings-default-padding">' . rex_i18n::msg('svgcrop_settings_default_trim_padding') . '</label>',
    'field' => '<input id="svgcrop-settings-default-padding" class="form-control" type="number" step="0.5" min="0" name="default_trim_padding" value="' . rex_escape($defaultTrimPadding) . '" />',
];
$fields[] = [
    'label' => '<label for="svgcrop-settings-ratio-profiles">' . rex_i18n::msg('svgcrop_settings_ratio_profiles_json') . '</label>',
    'field' => '<textarea id="svgcrop-settings-ratio-profiles" class="form-control" name="ratio_profiles_json" rows="12">' . rex_escape($ratioProfilesJson) . '</textarea>'
        . '<p class="help-block">' . rex_i18n::msg('svgcrop_settings_ratio_profiles_help') . '</p>',
];

$fragment = new rex_fragment();
$fragment->setVar('elements', $fields, false);
$formFields = $fragment->parse('core/form/form.php');

$buttonsFragment = new rex_fragment();
$buttonsFragment->setVar('elements', [
    ['field' => '<button class="btn btn-apply rex-form-aligned" type="submit" name="btn_save" value="1">' . rex_i18n::msg('form_save') . '</button>'],
], false);
$buttons = $buttonsFragment->parse('core/form/submit.php');

$body = '<form action="' . rex_url::currentBackendPage() . '" method="post">'
    . $csrf->getHiddenField()
    . $formFields
    . $buttons
    . '</form>';

$section = new rex_fragment();
$section->setVar('class', 'edit', false);
$section->setVar('title', rex_i18n::msg('svgcrop_settings_title'), false);
$section->setVar('options', $options, false);
$section->setVar('body', $body, false);

echo $section->parse('core/page/section.php');
