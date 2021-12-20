import { LambdaProxyResponse, SmsLambdaHandler } from "./sms-lambda-types";
import { twiml } from "twilio";
import { parseTokens, parseCommand } from "./lexer";

/**
 * Resolve the Sms request.
 * @param event the Sms event.
 */
const lambdaHandler: SmsLambdaHandler = async (event) => {
  console.log("Got event body", event.body);

  const response = new twiml.MessagingResponse();

  // Add a message to the Twilio response and log it.
  function message(message: string) {
    console.log(`Adding message: ${message}`);
    response.message(message);
  }

  // Create a 200 Okay response with Twilio markup.
  function makeTwilioResponseOkay(): LambdaProxyResponse {
    const responseMessage = response.toString();
    console.log(`Creating 200 response: ${responseMessage}`);
    return makeTwilioResponse("200", responseMessage);
  }

  const parsedRequestBody = parseRequestBody(event.body);

  if (!isAuthorizedRequest(parsedRequestBody)) {
    message("You are not authorized.");
    return makeTwilioResponseOkay();
  }

  const userMessage = parsedRequestBody.get("Body");
  if (!userMessage) {
    message("Error getting user message.");
    return makeTwilioResponseOkay();
  }
  console.log(`Got user message: ${userMessage}`);

  // Convert the request SMS into tokens.
  const tokens = parseTokens(parsedRequestBody.get("Body"));
  if (typeof tokens === "string") {
    message(`Error parsing tokens: ${tokens}`);
    return makeTwilioResponseOkay();
  }
  console.log(`Got tokens: ${tokens.map(token => `[${token.type}:${token.text}]`).toString()}`);

  // Convert the tokens into a command.
  const command = parseCommand(tokens);
  if (typeof command === "string") {
    message(`Error parsing command: ${command}`);
    return makeTwilioResponseOkay();
  }

  // Run the command and catch any unresolved errors.
  try {
    const commandResult = await command.fun(...command.args);

    if (commandResult.code === "User Error") {
      message(`User error when running command: ${commandResult.message}`);
      return makeTwilioResponseOkay();
    }
    else if (commandResult.code === "System Error") {
      message(`System error when running command: ${commandResult.message}`);
      return makeTwilioResponseOkay();
    }

    message(commandResult.message);
    return makeTwilioResponseOkay();
  }
  catch (err) {
    message(`Uncaught error when running command: ${String(err)}`);
    return makeTwilioResponseOkay();
  }
};

function isAuthorizedRequest(parsedRequestBody: Map<string, string>) {
  const fromPhoneNumber = parsedRequestBody.get("From");
  console.log(`Checking authorization for: ${fromPhoneNumber}`);
  return fromPhoneNumber && ["+12039149577", "+15163615780"].includes(fromPhoneNumber);
}

function parseRequestBody(requestBody: string) {
  // The request body is given in the format
  //  key1=value1&key2=value2
  const requestBodySegments = requestBody.split("&");
  const requestBodyMap = requestBodySegments.reduce((map, segment) => {
    const [key, value] = segment.split("=");
    map.set(key, decodeURIComponent(value.replace(/\+/g, " ")));
    return map;
  }, new Map());
  return requestBodyMap;
}

function makeTwilioResponse(statusCode: string, bodyXml: string): LambdaProxyResponse {
  return {
    statusCode: statusCode,
    body: bodyXml,
    headers: {
      "Content-Type": "text/xml",
    },
    isBase64Encoded: false,
  };
}

exports.lambdaHandler = lambdaHandler;
