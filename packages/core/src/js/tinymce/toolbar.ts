import $ from 'jquery';
import { Editor } from 'tinymce';
import type { EntityTypes } from '../schema/types';
import Writer from '../Writer';
import i18n from 'i18next';

const toolbarOptions = [
  'tags',
  '|',
  'tag-person',
  'tag-place',
  'tag-organization',
  'tag-title',
  'tag-referencing-string',
  'tag-citation',
  'tag-note',
  'tag-date',
  'tag-correction',
  'tag-keyword',
  'tag-link',
  'add-translation',
  '|',
  // 'edit-tag',
  // 'remove-tag',
  // '|',
  'toggle-tags',
  'show-raw-xml',
  'edit-raw-xml',
  '|',
  'validate',
  '|',
  'settings',
  'fullscreen',
  'documentation',
];

interface IButton {
  text?: string;
  slug: string;
  icon: string;
  tooltip: string;
  disabled: boolean;
  entityType?: EntityTypes;
  entityButton?: boolean;
  onSetup?: (api: IAPI) => (api: IAPI) => void;
  onAction: (api: IAPI) => void;
}

interface IAPI {
  isDisabled: () => boolean;
  setDisabled: (state: boolean) => void;
  isActive?: () => boolean;
  setActive?: (state: boolean) => void;
}

const configureToolbar = (writer: Writer, editor: Editor) => {
  const toogleButtons: IButton[] = [
    {
      slug: 'toggle-tags',
      icon: 'code',
      tooltip: 'Toggle Tags',
      disabled: false,
      onAction: (api) => {
        writer.overmindActions.editor.toggleShowTags();
        api.setActive(!api.isActive());
      },
    },
    {
      slug: 'fullscreen',
      icon: 'fullscreen',
      tooltip: 'Toggle Fullscreen',
      disabled: false,
      onAction: (api) => {
        writer.layoutManager.toggleFullScreen();
        api.setActive(!api.isActive());
      },
    },
  ];

  const buttons: IButton[] = [
    {
      text: 'Tags',
      slug: 'tags',
      icon: 'tags',
      tooltip: 'Tags',
      disabled: false,
      onAction: () => {
        const $button = $('.tox-tbtn').filter(
          (_index, element) => $(element).attr('title') === 'Tags'
        );

        const buttonOffset = $button.offset();
        const buttonHeight = $button.height() ?? 0;

        const posX = buttonOffset.left;
        const posY = buttonOffset.top - $(window).scrollTop() + buttonHeight;

        writer.overmindActions.ui.showContextMenu({
          show: true,
          eventSource: 'ribbon',
          position: { posX, posY },
          useSelection: true,
        });
      },
    },
    {
      slug: 'tag-person',
      icon: 'person',
      tooltip: 'Tag Person',
      disabled: false,
      entityButton: true,
      entityType: 'person',
      onAction: () => writer.tagger.addEntityDialog('person'),
    },
    {
      slug: 'tag-place',
      icon: 'place',
      tooltip: 'Tag Place',
      disabled: false,
      entityButton: true,
      entityType: 'place',
      onAction: () => writer.tagger.addEntityDialog('place'),
    },
    {
      slug: 'tag-organization',
      icon: 'organization',
      tooltip: 'Tag Organization',
      disabled: false,
      entityButton: true,
      entityType: 'organization',
      onAction: () => writer.tagger.addEntityDialog('organization'),
    },
    {
      slug: 'tag-title',
      icon: 'title',
      tooltip: 'Tag Text/Title',
      disabled: false,
      entityButton: true,
      entityType: 'title',
      onAction: () => writer.tagger.addEntityDialog('title'),
    },
    {
      slug: 'tag-date',
      icon: 'date',
      tooltip: 'Tag Date',
      disabled: false,
      entityButton: true,
      entityType: 'date',
      onAction: () => writer.tagger.addEntityDialog('date'),
    },
    {
      slug: 'tag-citation',
      icon: 'citation',
      tooltip: 'Tag Citation',
      disabled: false,
      entityButton: true,
      entityType: 'citation',
      onAction: () => writer.tagger.addEntityDialog('citation'),
    },
    {
      slug: 'tag-note',
      icon: 'note',
      tooltip: 'Tag Note',
      disabled: false,
      entityButton: true,
      entityType: 'note',
      onAction: () => writer.tagger.addEntityDialog('note'),
    },
    {
      slug: 'tag-correction',
      icon: 'correction',
      tooltip: 'Tag Correction',
      disabled: false,
      entityButton: true,
      entityType: 'correction',
      onAction: () => writer.tagger.addEntityDialog('correction'),
    },
    {
      slug: 'tag-keyword',
      icon: 'keyword',
      tooltip: 'Tag Keyword',
      disabled: false,
      entityButton: true,
      entityType: 'keyword',
      onAction: () => writer.tagger.addEntityDialog('keyword'),
    },
    {
      slug: 'tag-link',
      icon: 'link',
      tooltip: 'Tag Link',
      disabled: false,
      entityButton: true,
      entityType: 'link',
      onAction: () => writer.tagger.addEntityDialog('link'),
    },
    {
      slug: 'tag-referencing-string',
      icon: 'rs',
      tooltip: 'Tag Referencing String',
      disabled: false,
      entityButton: true,
      entityType: 'rs',
      onAction: () => writer.tagger.addEntityDialog('rs'),
    },
    {
      slug: 'add-translation',
      icon: 'translation',
      tooltip: 'Add Translation',
      disabled: false,
      onAction: () => writer.dialogManager.show('translation'),
    },
    // {
    //   slug: 'edit-tag',
    //   icon: 'tag-edit',
    //   tooltip: 'Edit Tag/Entity',
    //   disabled: false,
    //   onAction: () => writer.tagger.editTagDialog(),
    // },
    // {
    //   slug: 'remove-tag',
    //   icon: 'tag-remove',
    //   tooltip: 'Remove Tag',
    //   disabled: false,
    //   onAction: () => writer.tagger.removeTag(),
    // },
    // {
    //   slug: 'add-relation',
    //   icon: `relation`,
    //   tooltip: 'Add Relation',
    //   disabled: false,
    //   onAction: () => {
    //     //@ts-ignore
    //     $('#westTabs').tabs('option', 'active', 2);
    //     writer.dialogManager.show('triple');
    //   },
    // },
    {
      slug: 'show-raw-xml',
      icon: 'markup-file',
      tooltip: 'Show Raw XML',
      disabled: false,
      onAction: () => writer.selection?.showSelection(),
    },
    {
      slug: 'edit-raw-xml',
      icon: 'edit',
      tooltip: 'Edit Raw XML',
      disabled: false,
      onAction: async () => {
        const docText = await writer.converter.getDocumentContent(true);
        writer.overmindActions.ui.openEditSourceDialog(docText);
      },
    },
    {
      slug: 'validate',
      icon: 'validate',
      tooltip: 'Validate',
      disabled: false,
      onAction: () => writer.validate(),
    },
    {
      slug: 'settings',
      icon: 'settings',
      tooltip: 'Settings',
      disabled: false,
      onAction: () => writer.overmindActions.ui.openSettingsDialog(),
    },
    {
      slug: 'documentation',
      icon: 'help',
      tooltip: i18n.t('Documentation'),
      disabled: false,
      onAction: () => {
        window.open('https://www.leaf-vre.org/docs/documentation/leaf-writer-documentation');
      },
    },
  ];

  toogleButtons.map((button) => {
    editor.ui.registry.addToggleButton(button.slug, button);
  });

  buttons.map((button) => {
    editor.ui.registry.addButton(button.slug, button);
  });
};

export { configureToolbar, toolbarOptions };
