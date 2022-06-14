import { Resource, StorageDialogState, StorageProvider } from '@src/types';

type State = {
  recentDocuments: Resource[];
  resource?: Resource;
  sampleDocuments?: { title: string; url: string }[];
  templates: { icon: string; title: string; url: string }[];
  storageDialogState: StorageDialogState;
  storageProviders: StorageProvider[];
};

export const state: State = {
  recentDocuments: [],
  sampleDocuments: [
    {
      title: 'Sample Letter',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20letter%20template.xml',
    },
    {
      title: 'Sample Poem',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20poem%20template.xml',
    },
  ],

  storageDialogState: { open: false },
  storageProviders: [],
  templates: [
    {
      icon: 'blankPage',
      title: 'Blank',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20blank%20template.xml',
    },
    {
      icon: 'letter',
      title: 'Letter',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20letter%20template.xml',
    },
    {
      icon: 'feather',
      title: 'Poem',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20poem%20template.xml',
    },
    {
      icon: 'prose',
      title: 'Prose',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20prose%20template.xml',
    },
  ],
};
