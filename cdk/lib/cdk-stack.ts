import { Stack, StackProps, Duration } from 'aws-cdk-lib/core';
import { Runtime, FunctionUrlAuthType, InvokeMode, Architecture, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { Distribution, CachePolicy, HttpVersion, ViewerProtocolPolicy, OriginRequestPolicy, CfnOriginAccessControl, CfnDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { resolve } from 'path';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class StreamingResponseStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const { account: accountId } = Stack.of(this);

    const fn = new NodejsFunction(this, `LambdaFunction`, {
      runtime: Runtime.NODEJS_20_X,
      entry: resolve(__dirname, '../../src/handler/index.ts'),
      timeout: Duration.minutes(5),
      memorySize: 1024,
      architecture: Architecture.ARM_64
    });

    new LogGroup(this, `LambdaLogGroup`, {
      retention: RetentionDays.ONE_DAY,
      logGroupName: `/aws/lambda/${fn.functionName}`
    });

    const fnUrl = fn.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM,
      cors: {
          allowCredentials: true,
          allowedHeaders: ['*'],
          allowedMethods: [ HttpMethod.ALL ],
          allowedOrigins: [ '*' ],
          maxAge: Duration.days(1),
      },
    });

    const distribution = new Distribution(this, `CloudFrontDistribution`, {
      defaultBehavior: {
        origin: new FunctionUrlOrigin(fnUrl),
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
    });

    const lambdaOriginAccessControl = new CfnOriginAccessControl(this, 'LambdaUrlOAC', {
      originAccessControlConfig: {
          name: `Lambda-URL-OAC`,
          originAccessControlOriginType: 'lambda',
          signingBehavior: 'always',
          signingProtocol: 'sigv4',
      },
    });

    fnUrl.grantInvokeUrl(new ServicePrincipal('cloudfront.amazonaws.com', {
      conditions: {
          ArnLike: {
              'aws:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
          },
          StringEquals: {
              'aws:SourceAccount': accountId,
          },
      }
    }));

    const cfCfnDist = distribution.node.defaultChild as CfnDistribution;
    cfCfnDist.addPropertyOverride(
        'DistributionConfig.Origins.0.OriginAccessControlId',
        lambdaOriginAccessControl.getAtt('Id')
    );
  }
}