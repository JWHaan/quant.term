// Type declarations for third-party modules
// NOTE: This file exists to suppress TS errors for modules that may be
// conditionally loaded or have imperfect type definitions.
// If you see an error here being suppressed, fix the actual import instead.

declare module 'lightweight-charts' {
  export * from 'lightweight-charts';
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
