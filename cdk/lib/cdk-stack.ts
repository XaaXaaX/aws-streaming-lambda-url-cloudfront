import { Stack, StackProps, Duration } from 'aws-cdk-lib/core';
import { Runtime, FunctionUrlAuthType, InvokeMode, Architecture } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { Distribution, CachePolicy, HttpVersion } from 'aws-cdk-lib/aws-cloudfront';
import { FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { resolve } from 'path';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
export class StreamingResponseStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const logGroup = new LogGroup(this, `${this.stackName}-streaming-lambda-loggroup`, {
      retention: RetentionDays.ONE_DAY,
      logGroupName: `/aws/lambda/${this.stackName}-streaming-function`
    });
    const fn = new NodejsFunction(this, `${this.stackName}-streaming-lambda-function`, {
      runtime: Runtime.NODEJS_20_X,
      logGroup,
      functionName: `${this.stackName}-streaming-function`,
      entry: resolve(__dirname, '../../src/handler/index.ts'),
      timeout: Duration.minutes(5),
      memorySize: 1024,
      architecture: Architecture.ARM_64
    });

    const url = fn.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      invokeMode: InvokeMode.RESPONSE_STREAM,
    });

    new Distribution(this, `${this.stackName}-distribution`, {
      defaultBehavior: {
        origin: new FunctionUrlOrigin(url),
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
    });
    
  }
}