/**
 * Creation and management of simple lists of text. Supports creating, appending,
 * printing, and line replacement.
 */
import { CommandFunction } from "../lexer";
import { GetObjectCommandOutput, S3 } from "@aws-sdk/client-s3";
import { Stream } from "stream";

const BUCKET_NAME = process.env.MARCUS_LIST_BUCKET_NAME;

const s3Client = new S3({
  region: process.env.MARCUS_REGION,
});

function getListKey(listName: string) {
  return `lists/${listName}.txt`;
}

function isNumberString(input: string) {
  return input.match(/^\d+$/);
}

function textToLines(text: string) {
  return text.split("\n").slice(0, -1);
}

function linesToText(lines: string[]) {
  if (lines.length === 0) {
    return "";
  }
  return lines.join("\n") + "\n";
}

async function s3ObjectToString(getObjectResult: GetObjectCommandOutput): Promise<string> {
  // Undocumented AWS garbage makes reading objects from S3 very difficult.
  // See here for the docs that I could find:
  // https://github.com/aws/aws-sdk-js-v3/issues/1877
  // https://github.com/aws/aws-sdk-js-v3/issues/1096
  const stream = getObjectResult.Body as Stream;

  const chunks: Uint8Array[] = [];

  return await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

/**
 * Create a new list.
 */
export const listMake: CommandFunction = async (...args) => {
  if (args.length < 1) {
    return {
      code: "User Error",
      message: "List name not given.",
    };
  }
  if (args.length > 1) {
    return {
      code: "User Error",
      message: "Too many arguments supplied.",
    };
  }

  const listName = args[0];

  await s3Client.putObject({
    Bucket: BUCKET_NAME,
    Key: getListKey(listName),
    Body: linesToText([]),
  });

  return {
    code: "Success",
    message: `${listName}: created list.`,
  };
};

/**
 * Print a list.
 */
export const listPrint: CommandFunction = async (...args) => {
  if (args.length < 1) {
    return {
      code: "User Error",
      message: "List name not given.",
    };
  }
  if (args.length > 1) {
    return {
      code: "User Error",
      message: "Too many arguments supplied.",
    };
  }

  const listName = args[0];

  try {
    const getObjectResult = await s3Client.getObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
    });

    const listText = await s3ObjectToString(getObjectResult);
    const numberedListText = linesToText(
      textToLines(listText).map((line, index) => `${index + 1}: ${line}`).concat(["~"])
    );

    return {
      code: "Success",
      message: numberedListText,
    };
  }
  catch (err) {
    return {
      code: "User Error",
      message: "Could not find the object.",
    };
  }
};

/**
 * Add a new line to a list.
 */
export const listAppend: CommandFunction = async (...args) => {
  if (args.length < 1) {
    return {
      code: "User Error",
      message: "List name not given.",
    };
  }

  const listName = args[0];
  const lines = args.splice(1).filter(line => line.trim() !== "");

  try {
    const getObjectResult = await s3Client.getObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
    });

    const listText = await s3ObjectToString(getObjectResult);
    const newListText = linesToText(textToLines(listText).concat(lines));

    await s3Client.putObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
      Body: newListText,
    });

    return {
      code: "Success",
      message: `${listName}: added ${lines.length} line${lines.length === 1 ? "" : "s"}\n`,
    };
  }
  catch {
    return {
      code: "User Error",
      message: `${listName}: could not append lines.`,
    };
  }
};

/**
 * Replace a line in a list with a new line, or delete the line.
 */
export const listReplace: CommandFunction = async (...args) => {
  if (args.length < 1) {
    return {
      code: "User Error",
      message: "List name not given.",
    };
  }

  const listName = args[0];

  let replaceIndex: number;
  let replaceWithLine;
  if (args.length === 1) {
    // No further args are given. Delete the last line.
    replaceIndex = -1;
    replaceWithLine = "";
  }
  else if (args.length === 2) {
    if (isNumberString(args[1])) {
      // Only the line number is given. Delete the line.
      replaceIndex = Number(args[1]) - 1;
      replaceWithLine = "";
    }
    else {
      // Only the line is given. Replace the last line in the list.
      replaceIndex = -1;
      replaceWithLine = args[1];
    }
  }
  else if (args.length === 3) {
    replaceIndex = Number(args[1]) - 1;
    replaceWithLine = args[2];
  }
  else {
    return {
      code: "User Error",
      message: `${listName}: too many arguments supplied.`,
    };
  }

  try {
    const getObjectResult = await s3Client.getObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
    });

    const listText = await s3ObjectToString(getObjectResult);
    let listLines = textToLines(listText);

    if (replaceIndex === -1) {
      replaceIndex = listLines.length - 1;
    }

    if (replaceIndex < 0 || replaceIndex >= listLines.length) {
      return {
        code: "User Error",
        message: `${listName}: invalid replace line index.`,
      };
    }

    if (replaceWithLine === "") {
      listLines = listLines.filter((value, index) => index !== replaceIndex);
    }
    else {
      listLines[replaceIndex] = replaceWithLine;
    }
    const newListText = linesToText(listLines);

    await s3Client.putObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
      Body: newListText,
    });

    return {
      code: "Success",
      message: `${listName}: replaced line ${replaceIndex + 1} with ${replaceWithLine}`,
    };
  }
  catch {
    return {
      code: "User Error",
      message: `${listName}: could not replace line.`,
    };
  }
};
