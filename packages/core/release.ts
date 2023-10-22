import shell from 'shelljs';

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}

//copy images
shell.cp('-r', './src/images', './lib/images');

//copy css
shell.mkdir('./lib/css');
shell.cp('./src/css/build/editor.css', './lib/css');

//copy tinymce skins
shell.mkdir('-p', './lib/css/tinymce/skins');
shell.cp('-r', './src/css/tinymce/skins', './lib/css/tinymce/');

//copy @cwrc/leafwriter-validator worker
shell.cp('../validator/dist/leafwriter-validator.worker.*', './lib');

//copy monaco-editor-worker
shell.cp('dist/monaco-*', './lib');
