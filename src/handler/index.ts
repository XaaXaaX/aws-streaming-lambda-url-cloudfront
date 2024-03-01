import type { APIGatewayProxyEventV2, Context, Handler } from "aws-lambda";
import { promisify } from "node:util";
import { Writable, Readable, pipeline as streamPipelineFn } from "node:stream";

declare global {
  namespace awslambda {
    export namespace HttpResponseStream {
      function from(writable: Writable, metadata: any): Writable;
    }
    
    export type ResponseStream = Writable & {
      setContentType(type: string): void;
    }

    export type StreamifyHandler = (event: APIGatewayProxyEventV2, responseStream: ResponseStream, context: Context) => Promise<any>;

    export function streamifyResponse(handler: StreamifyHandler): Handler<APIGatewayProxyEventV2>;
  }
}

const createRange = (start: number, end: number) => {
  const range: number[] = [];
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  return range;
};

const pipeline = promisify(streamPipelineFn);

const txtData = createRange(1, 10000000).join(', ');

export const handler = awslambda.streamifyResponse(async (_event, responseStream): Promise<any> => {
  const requestStream = Readable.from(Buffer.from(txtData));
  await pipeline(requestStream, responseStream);
});