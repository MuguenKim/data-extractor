// Minimal Node shims for environments without @types/node
declare const process: any;
declare const Buffer: any;
type Buffer = any;
declare function require(name: string): any;

declare module "msgreader";
declare module "unzipper";
