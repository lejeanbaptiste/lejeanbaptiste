//@ts-nocheck 
import tinymce from 'tinymce';

tinymce.PluginManager.add('cwrcpath', function (editor) {
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

      editor.writer.event('loadingDocument').subscribe(function () {
        self.row([]);
      });

      //  if (editor.settings.elementpath !== false) {
      self.on('select', function (event) {
        //  editor.focus();
        //  editor.selection.select(this.row()[e.index].element);
        //  editor.nodeChanged();
        const el = this.row()[event.index].element;
        const id = el.getAttribute('id');
        editor.writer.utilities.selectElementById(id, false);
      });

      editor.on('nodeChange', function (event) {
        const outParents = [],
          parents = event.parents,
          i = parents.length;

        while (i--) {
          const n = parents[i];
          if (n.nodeType === 1 && !isHidden(n)) {
            let tag = n.getAttribute('_tag');
            let id = n.getAttribute('id');

            if (id === 'entityHighlight') {
              const w = editor.writer;
              id = w.entitiesManager.getCurrentEntity();
              tag = w.entitiesManager.getEntity(id).getTag();
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
