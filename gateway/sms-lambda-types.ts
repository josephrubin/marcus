/**
 * Type for lambda handlers that resolve sms requests.
 */
export type SmsLambdaHandler = (event: SmsEvent, context: object) => void

/**
 * Type for the event object passed to lambda resolvers.
 */
export interface SmsEvent {
  readonly body: string,
}

export interface LambdaProxyResponse {
  readonly statusCode: string,
  readonly body: string,
  readonly isBase64Encoded?: boolean,
  readonly headers?: { [key: string]: string|number }
}
