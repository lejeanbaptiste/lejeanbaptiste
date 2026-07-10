declare module '../../../../../node_modules/jquery/dist/jquery.js' {
  import type jquery from 'jquery';

  const $: typeof jquery;
  export default $;
}
