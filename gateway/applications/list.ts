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

function mapLines<U>(input: string, callback: (value: string, index: number, array: string[]) => U) {
  // Run the map function on every line (lines end in \n)
  // and return the result. Empty lines are not allowed.
  if (input === "") {
    return "";
  }
  return input
    .split("\n")
    .filter(line => line !== "" && line !== "\n")
    .map(callback)
    .join("\n")
    + "\n";
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
    Body: "",
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
    const numberedListText = mapLines(listText, (line, index) => `${index + 1}: ${line}`);

    return {
      code: "Success",
      message: numberedListText + "~",
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
  if (args.length > 2) {
    return {
      code: "User Error",
      message: "Too many arguments supplied.",
    };
  }

  const listName = args[0];

  if (args.length < 2 || args[1].trim() === "") {
    return {
      code: "User Error",
      message: "Cannot append a blank line. Supply a line.",
    };
  }

  const line = args[1] + "\n";

  try {
    const getObjectResult = await s3Client.getObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
    });

    const listText = await s3ObjectToString(getObjectResult);
    const newListText = listText + line;

    await s3Client.putObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
      Body: newListText,
    });

    return {
      code: "Success",
      message: `${listName}: added line ${line}`,
    };
  }
  catch {
    return {
      code: "User Error",
      message: `Could not append list ${listName}`,
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

  let replaceIndex;
  let replaceWithLine;
  if (args.length === 1) {
    // No further args are given. Delete the last line.
    replaceIndex = -1;
    replaceWithLine = "\n";
  }
  else if (args.length === 2) {
    if (isNumberString(args[1])) {
      // Only the line number is given. Delete the line by replacing with blank line
      // which will be filtered out.
      replaceIndex = Number(args[1]) - 1;
      replaceWithLine = "\n";
    }
    else {
      // Only the line is given. Replace the last line in the list.
      replaceIndex = -1;
      replaceWithLine = args[1] + "\n";
    }
  }
  else if (args.length === 3) {
    replaceIndex = Number(args[1]) - 1;
    replaceWithLine = args[2] + "\n";
  }
  else {
    return {
      code: "User Error",
      message: "Too many arguments supplied.",
    };
  }

  try {
    const getObjectResult = await s3Client.getObject({
      Bucket: BUCKET_NAME,
      Key: getListKey(listName),
    });

    const listText = await s3ObjectToString(getObjectResult);
    const listLines = listText.split("\n");

    if (replaceIndex === -1) {
      replaceIndex = listLines.length - 1;
    }

    if (replaceIndex < 0 || replaceIndex >= listLines.length) {
      return {
        code: "User Error",
        message: "Invalid replace line index.",
      };
    }

    // Replace the line and filter out any empty lines,
    // effectively deleting a line if a replacement was
    // not given.
    listLines[replaceIndex] = replaceWithLine;
    const newListText = listLines
      .filter(line => line !== "\n")
      .join("\n");

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
      message: `Could not replace line in list ${listName}`,
    };
  }
};
