// import $ from 'jquery';
// import 'jquery-ui/ui/widgets/dialog';
// // import { highlightElement } from 'prismjs';
// // import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
// // import 'prismjs/plugins/line-numbers/prism-line-numbers.js';
// import Writer from '../writer';

// class EditSource {
//   readonly writer: Writer;
//   readonly $edit: JQuery<HTMLElement>;
  

//   constructor(writer: Writer, parentEl: JQuery<HTMLElement>) {
//     this.writer = writer;

//     // this.$edit = $(`
//     //   <div>
//     //     <textarea
//     //       style="height: 100%; width: 100%; border: none; outline: none, font-family: monospace;"
//     //       spellcheck="false"
//     //     >
//     //     </textarea>
//     //   </div>
//     // `).appendTo(parentEl);

//     this.$edit = $(`
//       <div style="overflow: hidden;">
//         <pre
//           class="line-numbers"
//           autocapitalize="off"
//           autocomplete="off"
//           autocorrect="off"
//           contenteditable="true"
//           spellcheck="false"
//           style="
//             height: calc(100% - 7px);
//             white-space: pre-line;
//             padding-left: 3.8em;
//           "
//         >
//           <code
//             class="language-markup"
//             style="white-space: pre-wrap;"
//           >
//           </code>
//         </pre>
//       </div>
//     `).appendTo(parentEl);

//     //@ts-ignore
//     this.$edit.dialog({
//       title: 'Edit Source',
//       modal: true,
//       resizable: true,
//       closeOnEscape: true,
//       height: window.innerHeight - 160,
//       width: window.innerWidth - 160,
//       autoOpen: false,
//       buttons: [
//         {
//           text: 'Cancel',
//           role: 'cancel',
//           click: () => {
//             //@ts-ignore
//             this.$edit.dialog('close');
//           },
//         },
//         {
//           text: 'Ok',
//           role: 'ok',
//           click: () => {
//             const content = $('code', this.$edit).text();
//             //@ts-ignore
//             this.$edit.dialog('close');
//             this.writer.loadDocumentXML(content);
//           },
//         },
//       ],
//       open: function (event: JQuery.Event) {
//         const $text = $(this).find('code');
//         $text.trigger('focus');
//         $(this).find('pre').scrollTop(0);
//       },
//       close: () => $('code', this.$edit).val(''),
//     });
//   }

//   private doOpen() {
//     this.writer.dialogManager.confirm({
//       title: 'Edit Raw XML',
//       msg: `
//         Editing the XML directly is only recommended for advanced users who know what they are doing.<br/><br/>
//         Are you sure you wish to continue
//       `,
//       showConfirmKey: 'confirm-edit-source',
//       type: 'info',
//       callback: async (confirm: boolean) => {
//         if (!confirm) return;

//         const docText = await this.writer.converter.getDocumentContent(true);
//         // const escapedContents = this.writer.utilities.escapeHTMLString(docText);

//         this.writer.overmindActions.ui.openEditSourceDialog(docText);

//         // console.time('dialog open');
//         // //@ts-ignore
//         // this.$edit.dialog('open');
//         // console.timeEnd('dialog open');

//         // console.time('set doc text');
//         // const escapedContents = this.writer.utilities.escapeHTMLString(docText);
//         // // $('code', this.$edit).val(escapedContents);
//         // $('code').text(docText)
//         // console.timeEnd('set doc text');

//         // highlightElement($('code', this.$edit)[0]);
//       },
//     });
//   }

//   show() {
//     this.doOpen();
//   }

//   destroy() {
//     //@ts-ignore
//     this.$edit.dialog('destroy');
//   }
// }

// export default EditSource;
