/** The vendored CLI's files by name, which scripts/build.mjs puts into main.js. */
declare module 'virtual:page-scanner-cli' {
  const files: Readonly<Record<string, string>>;
  export default files;
}
