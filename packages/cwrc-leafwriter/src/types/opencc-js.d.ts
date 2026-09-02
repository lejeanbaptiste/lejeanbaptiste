declare module 'opencc-js' {
  interface OpenCCModule {
    Converter: (options: { from: string; to: string }) => (text: string) => string;
  }

  const OpenCC: OpenCCModule;
  export default OpenCC;
}
