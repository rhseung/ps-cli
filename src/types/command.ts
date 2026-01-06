export interface CommandFlags {
  language?: string;
  watch?: boolean;
  help?: boolean;
  [key: string]: unknown;
}

export interface CommandDefinition {
  name: string;
  help: string;
  execute: (args: string[], flags: CommandFlags) => Promise<void> | void;
}
