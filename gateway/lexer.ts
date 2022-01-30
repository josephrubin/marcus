import { listAppend, listMake, listPrint, listReplace } from "./applications/list";

/** The smallest lexical part of user input. */
interface Token {
  readonly type: "Command" | "Subcommand" | "Argument";
  readonly text: string;
}

/** The operation specified by the comman tokens from the user input. */
interface Command {
  readonly fun: CommandFunction;
  readonly args: string[];
}

export type CommandFunction = (...args: string[]) => Promise<CommandFunctionReturn>;

export interface CommandFunctionReturn {
  readonly code: "Success" | "User Error" | "System Error"
  readonly message: string
}

/** Convert a user's string into a sequence of tokens. */
export function parseTokens(input: string): Token[] | string {
  const tokens: Token[] = [];

  const segments = input.split(",");

  // The first segment should be the command name followed
  // by the subcommand name.
  if (segments.length < 1) {
    return "Missing first segment.";
  }
  const headSegment = segments[0].toLowerCase().trim();
  if (headSegment.length === 1) {
    tokens.push({
      type: "Command",
      text: headSegment.charAt(0),
    });
  }
  else if (headSegment.length === 2) {
    tokens.push({
      type: "Command",
      text: headSegment.charAt(0),
    });
    tokens.push({
      type: "Subcommand",
      text: headSegment.charAt(1),
    });
  }
  else {
    return "First segment too long.";
  }

  // The remaining segments are command arguments.
  const remainingTokens: Token[] = segments.slice(1).map(segment => ({
    type: "Argument",
    text: segment.trim(),
  }));

  return tokens.concat(remainingTokens);
}

export function parseCommand(tokens: Token[]) : Command | string {
  if (tokens.length < 1) {
    return "No command token.";
  }

  // Find the command token at the start and remove it.
  const commandToken = tokens[0];
  tokens = tokens.slice(1);
  if (commandToken.type !== "Command") {
    return "First token wasn't command token.";
  }

  // Find the optional subcommand token at the start and remove it.
  const subcommandToken = tokens.length >= 1 && tokens[0].type === "Subcommand"
    ? tokens[0]
    : null;
  if (subcommandToken) {
    tokens = tokens.slice(1);
  }

  // Find the argument tokens.
  const argumentTokens = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "Argument") {
      return "Non-argument type token found among trailing tokens.";
    }
    argumentTokens.push(tokens[i].text);
  }

  // Find the command function to run.
  const fun = ((command, subcommand) => {
    if (command === "l") {
      if (subcommand === "a") {
        return listAppend;
      }
      if (subcommand === "m") {
        return listMake;
      }
      if (subcommand === "p") {
        return listPrint;
      }
      if (subcommand === "r") {
        return listReplace;
      }
    }
    return null;
  })(commandToken.text, subcommandToken?.text);
  if (!fun) {
    return "Application function not found. You tried an invalid command.";
  }

  return {
    fun: fun.bind({}),
    args: argumentTokens,
  };
}
