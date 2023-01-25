import $ from 'jquery';
import 'jstree';
import { log } from '../../../../utilities';
import Writer from '../../../Writer';

interface StructureTreeProps {
  parentId: string;
  writer: Writer;
}

class StructureTree {
  readonly id: string;
  readonly writer: Writer;

  readonly NODE_SELECTED = 0;
  readonly CONTENTS_SELECTED = 1;
  readonly tagFilter: string[] = ['head', 'heading']; // array of tag names to filter tree by. "head" is for tei lite. "heading" is for cwrc entry.

  currentlySelectedNodes: any[] = []; // ids of the currently selected nodes
  selectionType: 0 | 1 | null = null; // is the node or the just the contents of the node selected?

  // 2 uses:
  // 1) we want to highlight a node in the tree without selecting it's counterpart in the editor
  // 2) a tree node has been clicked and we want to avoid re-running the selectNode function triggered by the editor's onNodeChange handler
  ignoreSelect = false;

  readonly $tree: JQuery<HTMLElement>; // tree reference

  initialized = false; // has $tree been initialized
  updatePending = false;
  enabled = true; // enabled means we update based on events

  constructor({ parentId, writer }: StructureTreeProps) {
    this.writer = writer;
    this.id = this.writer.getUniqueId('tree_');

    // add to writer
    this.writer.tree = this;

    $(`#${parentId}`).append(
      `<div class="moduleParent">
        <div id="${this.id}" class="moduleContent" style="flex: inherit"></div>
      </div>`
    );

    this.$tree = $(`#${this.id}`);

    // this.writer.utilities.addCSS('css/jstree/style.css');

    const plugins = ['wholerow', 'conditionalselect'];
    if (this.writer.isReadOnly !== true) plugins.push('dnd');

    this.$tree.jstree({
      plugins,
      core: {
        worker: false, // transpiler messing up web worker so set this false, see: https://github.com/vakata/jstree/issues/1717
        //@ts-ignore
        check_callback: (operation, node, node_parent, node_position, more) => {
          if (
            this.writer.editor.readonly &&
            (operation === 'move_node' || operation === 'copy_node')
          ) {
            return false; // prevent drag n drop when editor is readonly (such as during nerve vetting)
          }
          return true;
        },
        animation: true,
        themes: { icons: false, responsive: false, url: false },
        data: {
          li_attr: { id: 'cwrc_tree_root' },
          state: { opened: true },
          text: 'Tags',
        },
      },
      multiple: true,
      conditionalselect: this.doConditionalSelect,
      dnd: {
        large_drag_target: true,
        large_drop_target: true,
      },
    });

    this.$tree.on('contextmenu', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const $target = $(event.target).parents('li.jstree-node').first();

      if ($target.length !== 1) return;

      const selectedIds: any[] = this.currentlySelectedNodes; // store selected nodes before highlighting

      let tagId: string | string[] | undefined = $target.attr('name');
      if ($target.text().trim() === this.writer.schemaManager.getHeader()) {
        tagId = this.writer.schemaManager.getHeader();
      }

      this.highlightNode($(`#${tagId}`, this.writer.editor.getBody())[0]);
      if (selectedIds.indexOf(tagId) !== -1 && selectedIds.length > 1) {
        tagId = selectedIds;
      }

      // *prevent context menu on TEIHeader
      if (tagId === 'teiHeader') return;

      //select as if it was a left-click;
      const selectContents = this.isSelectedContents($target);
      const multiselect = this.isMultiselect(event);
      this.doSelectNode($target, selectContents, multiselect, false);

      // use setTimeout to make sure that highlight happens first
      setTimeout(() => {
        this.writer.overmindActions.ui.showContextMenu({
          show: true,
          position: { posX: event.clientX, posY: event.clientY },
          useSelection: false,
          tagId,
        });
      }, 0);
    });

    this.$tree.on('select_node.jstree', this.onNodeSelect);
    this.$tree.on('deselect_node.jstree', this.onNodeDeselect);

    $(document).on('dnd_start.vakata', this.handleDnDStart);
    $(document).on('dnd_move.vakata', this.handleDnDMove);

    this.$tree.on('copy_node.jstree', (event: any, data: any) => this.onDragDrop(data, true));

    this.$tree.on('move_node.jstree', (event: any, data: any) => this.onDragDrop(data, false));

    this.$tree.on('keydown.jstree', (event: any) => {
      //log.info(event);
    });

    this.$tree.on('ready.jstree', (event: any, data: any) => {
      this.initialized = true;
      if (this.updatePending) {
        this.update();
        this.updatePending = false;
      }
      this.writer.event('structureTreeInitialized').publish(this);
    });

    this.writer.event('loadingDocument').subscribe(() => {
      this.clear();
      this.disable();
    });

    this.writer.event('documentLoaded').subscribe(() => this.enable(true));

    this.writer.event('massUpdateStarted').subscribe(() => this.disable());

    this.writer.event('massUpdateCompleted').subscribe(() => this.enable(true));

    this.writer.event('nodeChanged').subscribe((currentNode: Element) => {
      if (!this.ignoreSelect) this.highlightNode(currentNode);
    });

    this.writer.event('contentChanged').subscribe(() => this.update());

    this.writer.event('contentCopied').subscribe(() => {
      if (this.currentlySelectedNodes.length <= 0) return;

      const clone = $(`#${this.currentlySelectedNodes[0]}`, this.writer.editor.getBody()).clone();
      this.writer.editor.copiedElement.element = clone.wrapAll('<div />').parent()[0];
      this.writer.editor.copiedElement.selectionType = this.selectionType;
    });

    this.writer.event('contentPasted').subscribe(() => this.update());

    this.writer.event('writerKeydown').subscribe((event: any) => {
      if (this.currentlySelectedNodes.length <= 0) return;

      const nodeId = this.currentlySelectedNodes[0];

      // browsers have trouble deleting divs, so use the tree and jquery as a workaround
      if (event.which == 8 || event.which == 46) {
        // cancel keyboard delete

        // TODO doesn't cancel quickly enough

        //@ts-ignore
        tinymce.dom.Event.cancel(evt);
        if (this.selectionType == this.NODE_SELECTED) {
          this.writer.tagger.removeStructureTag(nodeId, true);
        } else {
          this.writer.tagger.removeStructureTagContents(nodeId);
          this.writer.utilities.selectElementById(nodeId, true);
        }
      } else if (
        event.ctrlKey == false &&
        event.metaKey == false &&
        event.which >= 48 &&
        event.which <= 90
      ) {
        // handle alphanumeric characters when whole tree node is selected
        // remove the selected node and set the focus to the closest node
        if (this.selectionType == this.NODE_SELECTED) {
          const currNode = $(`#${nodeId}`, this.writer.editor.getBody());
          let collapseToStart = true;
          let newCurrentNode = currNode.nextAll('[_tag]')[0];

          if (newCurrentNode == null) {
            newCurrentNode = currNode.parent().nextAll('[_tag]')[0];

            if (newCurrentNode == null) {
              collapseToStart = false;
              newCurrentNode = currNode.prevAll('[_tag]')[0];
            }
          }

          this.writer.tagger.removeStructureTag(nodeId, true);

          if (newCurrentNode != null) {
            const rng = this.writer.editor.selection.getRng();
            rng.selectNodeContents(newCurrentNode);
            rng.collapse(collapseToStart);
            this.writer.editor.selection.setRng(rng);
          }
        }
      }
    });

    this.writer.event('writerKeyup').subscribe((event: any) => {
      // if the user's typing we don't want the currentlySelectedNodes to be set
      // calling highlightNode will clear currentlySelectedNodes
      // if (this.currentlySelectedNodes.length > 0) {
      //   const currNode = $(`#${this.currentlySelectedNodes[0]}`, this.writer.editor.getBody())[0];
      //   this.highlightNode(currNode);
      // }
    });

    this.writer.event('entityAdded').subscribe((entityId: string) => this.update());

    this.writer.event('entityRemoved').subscribe((entityId: string) => this.update());

    this.writer.event('entityFocused').subscribe((entityId: string) => {
      // if (!this.ignoreSelect) {
      //   const entityNode = $(`[name="${entityId}"]`, this.writer.editor.getBody())[0];
      //   this.highlightNode(entityNode);
      // }
      // this.ignoreSelect = false;
    });

    this.writer.event('entityPasted').subscribe((entityId: string) => this.update());

    this.writer.event('tagAdded').subscribe((tag: any) => this.update());

    this.writer.event('tagEdited').subscribe((tag: any) => this.update());

    this.writer.event('tagRemoved').subscribe((tag: any) => this.update());

    this.writer.event('tagContentsRemoved').subscribe((tagId: string) => this.update());

    this.writer.event('tagSelected').subscribe((tagId: string) => {
      // this.currentlySelectedNodes = [tagId];
      // this.selectNode(tagId, false);

      if (!this.ignoreSelect) this.selectNode(tagId, false);
      this.ignoreSelect = false;
    });
  }

  private handleDnDStart = (event: any, data: any) => {
    // TODO fullscreen support
    data.helper.addClass('cwrc');
    if (this.writer.layoutManager.isFullScreen()) {
      //@ts-ignore
      $.vakata.dnd.stop(event);
    }
    data.helper.appendTo(this.writer.layoutManager.getContainer());
  };

  private handleDnDMove = (event: any, data: any) => {
    // TODO fullscreen support
    const marker = $('#jstree-marker');
    if (marker.parent() !== this.writer.layoutManager.getContainer()) {
      marker.appendTo(this.writer.layoutManager.getContainer());
    }
    // const o = marker.offset();
    // marker.offset({top: p.top-60, left: p.left-2});
  };

  /**
   * Updates the tree to reflect the document structure.
   */
  update() {
    if (!this.initialized || !this.enabled) {
      this.updatePending = true;
      return;
    }

    const _this = this;

    const treeRef = $.jstree?.reference(`#${this.id}`);

    // store open nodes to re-open after updating
    const openNodes: string[] = [];
    $('#cwrc_tree_root', this.$tree)
      .find('li.jstree-open')
      .each(function () {
        const id = $(this).attr('name');
        openNodes.push(_this.id);
      });

    this.clear();

    let rootNode = $(
      `[_tag="${this.writer.schemaManager.getRoot()}"]`,
      this.writer.editor.getBody()
    );
    if (rootNode.length === 0) {
      // fallback if schema/root has changed
      rootNode = $('[_tag]', this.writer.editor.getBody()).first();
    }

    const rootData = this.processNode(rootNode, 0);

    if (rootData !== null) {
      //@ts-ignore
      rootData.li_attr.id = 'cwrc_tree_root';
      this.doUpdate(rootNode.children(), rootData, 0, rootData);

      if (this.writer.isReadOnly) {
        // clean up parent property added in doUpdate
        const removeParentProperty = (nodeData: any) => {
          delete nodeData.parent;
          if (nodeData.children) {
            nodeData.children.forEach((child: any) => removeParentProperty(child));
          }
        };
        removeParentProperty(rootData);
      }

      treeRef?.create_node(null, rootData);

      $.each(openNodes, (index, val) => {
        treeRef?.open_node($(`li[name=${val}]`, this.$tree), null, false);
      });
    }
  }

  clear() {
    const treeRef = $.jstree?.reference(`#${this.id}`);
    treeRef?.delete_node('#cwrc_tree_root');
  }

  enable(forceUpdate: boolean) {
    this.enabled = true;
    if (forceUpdate || this.updatePending) {
      this.update();
      this.updatePending = false;
    }
  }

  disable() {
    this.enabled = false;
  }

  destroy() {
    $(document).off('dnd_start.vakata', this.handleDnDStart);
    $(document).off('dnd_move.vakata', this.handleDnDMove);

    $.jstree?.reference(`#${this.id}`).destroy();
  }

  /**
   * Expands the parents of a particular node. Returns the ID of the header if the node was inside the document header.
   * @param {Element} node A node that exists in the editor
   * @returns {String | null} The header ID if the node was inside of it
   */
  private expandParentsForNode(node: Element) {
    let headerId: string | null = null;

    // get the actual parent nodes in the editor
    const parents: string[] = [];

    $(node)
      .parentsUntil('#tinymce')
      .each((index, el) => {
        if (el.getAttribute('_tag') === this.writer.schemaManager.getHeader()) {
          headerId = el.id;
        }
        parents.push(el.id);
      });
    parents.reverse();

    // TODO handling for readonly mode where only headings are in the tree

    // expand the corresponding nodes in the tree
    for (const parentId of parents) {
      const parentNode = $(`[name="${parentId}"]`, this.$tree);
      const isOpen = this.$tree.jstree('is_open', parentNode);
      if (!isOpen) this.$tree.jstree('open_node', parentNode, null, false);
    }

    return headerId;
  }

  /**
   * Displays (if collapsed) and highlights a node in the tree based on a node in the editor
   * @param {Element} node A node that exists in the editor
   */
  private highlightNode(node?: Element) {
    if (!node) {
      this.onNodeDeselect();
      return;
    }

    const id = node.id;
    if (!id) return;

    // TODO handling of entity name attribute

    if (this.currentlySelectedNodes.indexOf(id) !== -1) {
      this.onNodeDeselect();
      return;
    }

    this.ignoreSelect = true;
    let treeNode = $(`[name="${id}"]`, this.$tree);

    if (treeNode.length === 0) {
      const headerId = this.expandParentsForNode(node);
      treeNode = headerId ? $(`[name="${headerId}"]`, this.$tree) : $(`[name="${id}"]`, this.$tree);
    }

    this.$tree.jstree('deselect_all');
    this.onNodeDeselect(); // manually trigger deselect behaviour, primarily to clear currentlySelectedNodes

    const result = this.$tree.jstree('select_node', treeNode);
    //if (result === false || result.attr('id') === 'tree') {
    this.ignoreSelect = false;
    //}

    this.scrollIntoView(treeNode);
  }

  private scrollIntoView($node: JQuery<HTMLElement>) {
    if ($node.length !== 1) return;

    const $nodeOffset = $node.offset();
    const $nodeOuterHeight = $node.outerHeight();
    const $nodeOuterInnerHeight = $node.innerHeight();
    const this$treeOffset = $node.offset();
    const this$treeScrollTop = $node.scrollTop();

    if (
      !$nodeOffset ||
      !$nodeOuterHeight ||
      !$nodeOuterInnerHeight ||
      !this$treeOffset ||
      !this$treeScrollTop
    ) {
      return;
    }

    const o = $nodeOffset.top - this$treeOffset.top;
    const t = o + this$treeScrollTop;
    const b = t + $nodeOuterHeight;
    const ch = $nodeOuterInnerHeight;
    const halfCH = ch * 0.5;
    const ct = parseInt(this$treeScrollTop.toString(), 10);
    const cb = ct + ch;

    if ($nodeOuterHeight > ch || t < ct) {
      // scroll up
      this.$tree.scrollTop(t - halfCH);
    } else if (b > cb) {
      // scroll down
      this.$tree.scrollTop(b - halfCH);
    }
  }

  /**
   * Selects a node in the tree based on a node in the editor
   * @param {String} id The id of the node
   * @param {Boolean} selectContents True to select contents
   */
  selectNode(id: string, selectContents: boolean) {
    if (!id) return;

    let treeNode = $(`[name="${id}"]`, this.$tree);

    if (treeNode.length === 0) {
      const $node = $(`#${id}`, this.writer.editor.getBody());
      const headerId = this.expandParentsForNode($node[0]);
      treeNode = headerId ? $(`[name="${headerId}"]`, this.$tree) : $(`[name="${id}"]`, this.$tree);
    }

    this.doSelectNode(treeNode, selectContents, false, true);
  }

  /**
   * Performs actual selection of a tree node
   * @param {Element} $node A jquery node (LI) in the tree
   * @param {Boolean} selectContents True to select contents
   * @param {Boolean} multiselect True if ctrl or select was held when selecting
   * @param {Boolean} external True if selectNode came from outside structureTree, i.e. tree.selectNode
   */
  private doSelectNode = (
    $node: JQuery<HTMLElement>,
    selectContents: boolean,
    multiselect: boolean,
    external: boolean
  ) => {
    const id = $node.attr('name');

    this.removeCustomClasses();

    // clear other selections if not multiselect
    if (!multiselect) {
      if (this.currentlySelectedNodes.indexOf(id) !== -1) {
        this.currentlySelectedNodes = [id];
      } else {
        this.currentlySelectedNodes = [];
      }
    }

    if (!id) return;

    const aChildren = $node.children('a');

    if (this.currentlySelectedNodes.indexOf(id) !== -1 && !external) {
      // already selected node, do nothing
    } else {
      this.currentlySelectedNodes.push(id);
    }

    if (selectContents) {
      aChildren.addClass('contentsSelected').removeClass('nodeSelected');
      this.selectionType = this.CONTENTS_SELECTED;
    } else {
      aChildren.addClass('nodeSelected').removeClass('contentsSelected');
      this.selectionType = this.NODE_SELECTED;
    }

    if (!external) {
      const $editorNode = $(`#${id}`, this.writer.editor.getBody());
      const isEntity = $editorNode.attr('_entity') === 'true';
      if (!isEntity && $editorNode.attr('_tag') === this.writer.schemaManager.getHeader()) {
        // this.writer.dialogManager.show('header');
      } else {
        this.ignoreSelect = true; // set to true so tree.highlightNode code isn't run by editor's onNodeChange handler
        this.writer.utilities.selectElementById(this.currentlySelectedNodes, selectContents);
      }
    }
  };

  /**
   * Processes an element in the editor and returns relevant data for the tree
   * @param node A jQuery object
   * @param level The current tree depth
   */

  private processNode(node: JQuery<any>, level: number) {
    let nodeData = null;

    let tag = node.attr('_tag');
    if (!tag) return null;

    // entity tag
    if (this.writer.isReadOnly === false && node.attr('_entity')) {
      const id = node.attr('name');
      if (id === undefined) {
        log.warn('structureTree: no id for', tag);
        return null;
      }

      nodeData = {
        text: tag,
        li_attr: { name: id }, // 'class': type}
        state: { opened: level < 3 },
        level: level,
      };
      // structure tag
    } else {
      if (
        this.writer.isReadOnly === false ||
        (this.writer.isReadOnly &&
          (tag === this.writer.schemaManager.getRoot() ||
            this.tagFilter.indexOf(tag.toLowerCase()) !== -1))
      ) {
        const id = node.attr('id');
        if (!id) {
          log.warn('structureTree: no id for', tag);
          return null;
        }

        if (this.writer.isReadOnly) {
          if (tag !== this.writer.schemaManager.getRoot()) {
            tag = this.writer.utilities.getTitleFromContent(node.text());
          }
        }

        nodeData = {
          text: tag,
          li_attr: { name: id },
          state: { opened: level < 3 },
          level: level,
        };
      }
    }

    if (this.writer.schemaManager.schemaId === 'cwrcEntry') {
      // FIXME we really shouldn't have this hardcoded here
      // manually set the level for CWRC schema to have proper sorting in readOnly mode
      const subtype = node.attr('subtype');
      //@ts-ignore
      if (subtype !== undefined) nodeData.level = parseInt(subtype);
    }

    return nodeData;
  }

  /**
   * Recursively work through all elements in the editor and create the data for the tree.
   */
  private doUpdate(children: JQuery<HTMLElement>, nodeParent: any, level: number, lastEntry: any) {
    const _this = this;

    children.each(function (index: number, el: any) {
      const node = $(this);
      let newNodeParent = nodeParent;

      const nodeData = _this.processNode(node, level);

      if (nodeData) {
        if (_this.writer.isReadOnly && lastEntry != null) {
          while (lastEntry.level >= nodeData.level) {
            lastEntry = lastEntry.parent;
          }

          if (lastEntry.children == null) lastEntry.children = [];

          //@ts-ignore
          nodeData.parent = lastEntry;
          lastEntry.children.push(nodeData);
        } else {
          if (nodeParent.children == null) nodeParent.children = [];
          nodeParent.children.push(nodeData);
          newNodeParent = nodeParent.children[nodeParent.children.length - 1];
        }

        lastEntry = nodeData;
      }

      if (node.attr('_tag') !== _this.writer.schemaManager.getHeader()) {
        _this.doUpdate(node.children(), newNodeParent, level + 1, lastEntry);
      }
    });
  }

  private doConditionalSelect = (node: any, event?: any) => {
    //@ts-ignore
    if ((tinymce.isMac ? event.metaKey : event.ctrlKey) || event.shiftKey) {
      // only allow multiselect for siblings
      const selected = this.$tree.jstree('get_selected');

      if (selected.length == 0) return true;

      const liId = selected[0];
      if (liId == node.id) return true;

      const isSibling = $(`#${liId}`).siblings(`#${node.id}`).length == 1;
      return isSibling;
    }

    return true;
  };

  private onNodeSelect = (event: any, data: any) => {
    // if (this.ignoreSelect) return;
    if (!data.event) return;

    const $target = $(data.event.currentTarget);

    const selectContents = this.isSelectedContents($target);
    const multiselect = this.isMultiselect(data.event);

    this.doSelectNode($target.parent(), selectContents, multiselect, false);
  };

  private isSelectedContents($target: JQuery<any>) {
    let selectContents = true;

    if ($target.hasClass('contentsSelected')) selectContents = false;
    if ($target.hasClass('nodeSelected')) selectContents = true;

    return selectContents;
  }

  private isMultiselect(event: any) {
    let multiselect = false;
    //@ts-ignore
    multiselect = (tinymce.isMac ? event.metaKey : event.ctrlKey) || event.shiftKey;
    return multiselect;
  }

  private onNodeDeselect = (event?: any, data?: any) => {
    if (data !== undefined) {
      const $target = $(data.event.currentTarget);
      $target.removeClass('nodeSelected contentsSelected');
      const id = data.node.li_attr.name;
      const index = this.currentlySelectedNodes.indexOf(id);
      if (index !== -1) this.currentlySelectedNodes.splice(index, 1);
    } else {
      // clear everything
      this.removeCustomClasses();
      this.currentlySelectedNodes = [];
    }

    this.selectionType = null;
  };

  private onDragDrop(data: any, isCopy: boolean) {
    const dragNode = data.node;
    const dropNode = this.$tree.jstree('get_node', data.parent);

    let dragNodeEditor = $(`#${dragNode.li_attr.name}`, this.writer.editor.getBody());
    let dropNodeEditor = $(`#${dropNode.li_attr.name}`, this.writer.editor.getBody());

    if (dragNodeEditor.parents('.noteWrapper').length > 0) {
      dragNodeEditor = dragNodeEditor.parents('.noteWrapper').first();
    }

    if (isCopy) dragNodeEditor = dragNodeEditor.clone();

    if (data.position === 0) {
      dropNodeEditor.prepend(dragNodeEditor);
    } else {
      const prevSiblingId = dropNode.children[data.position - 1];
      const prevSibling = this.$tree.jstree('get_node', prevSiblingId);
      dropNodeEditor = $(`#${prevSibling.li_attr.name}`, this.writer.editor.getBody());
      dropNodeEditor.after(dragNodeEditor);
    }

    this.$tree.jstree('open_node', dropNode, null, false);

    if (isCopy) this.writer.tagger.processNewContent(dragNodeEditor[0]);

    this.writer.editor.undoManager.add();
    this.writer.event('contentChanged').publish();
  }

  private removeCustomClasses() {
    const nodes = $('a[class*=Selected]', `#${this.id}`);
    nodes.removeClass('nodeSelected contentsSelected');
  }

  private showPopup(content: any) {
    $('#tree_popup').html(content).show();
  }

  private hidePopup() {
    $('#tree_popup').hide();
  }
}

export default StructureTree;
