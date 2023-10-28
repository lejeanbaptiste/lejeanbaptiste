import tinymce from 'tinymce';
import { LeafWriterEditor } from '../../../types';

tinymce.PluginManager.add('cwrcpath', function (editor: LeafWriterEditor) {
  //@ts-ignore
  tinymce.ui.CWRCPath = tinymce.ui.Path.extend({
    postRender: function () {
      const self = this;

      function isHidden(element: Element) {
        if (element.nodeType === 1) {
          if (element.nodeName == 'BR' || !!element.getAttribute('data-mce-bogus')) {
            return true;
          }

          if (element.getAttribute('data-mce-type') === 'bookmark') {
            return true;
          }
        }

        return false;
      }

      editor.writer?.event('loadingDocument').subscribe(function () {
        self.row([]);
      });

      //  if (editor.settings.elementpath !== false) {
      //@ts-ignore
      self.on('select', function (event) {
        //  editor.focus();
        //  editor.selection.select(this.row()[e.index].element);
        //  editor.nodeChanged();
        //@ts-ignore
        const el = this.row()[event.index].element;
        const id = el.getAttribute('id');
        editor.writer?.utilities.selectElementById(id, false);
      });

      editor.on('nodeChange', (event) => {
        const outParents = [];
        const parents = event.parents;
        let i = parents.length;

        while (i--) {
          const n = parents[i];
          if (n.nodeType === 1 && !isHidden(n)) {
            let tag = n.getAttribute('_tag');
            let id = n.getAttribute('id');

            if (id === 'entityHighlight') {
              id = editor.writer?.entitiesManager?.getCurrentEntity();
              tag = editor.writer?.entitiesManager?.getEntity(id)?.getTag();
            }

            if (tag) outParents.push({ name: tag, element: n });
          }
        }

        self.row(outParents);
      });

      return self._super();
    },
  });

  //@ts-ignore
  const path = new tinymce.ui.CWRCPath(editor);
});
