import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";

export class MarcusStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /* Store data for the List application. */
    const listBucket = new s3.Bucket(this, "ListBucket", {
      bucketName: "marcus-list-bucket",
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    /* Receive SMS messages and send a message back. */
    const smsResolverLambda = new nodelambda.NodejsFunction(this, "SmsResolverLambda", {
      functionName: "MarcusSmsResolverLambda",

      runtime: lambda.Runtime.NODEJS_14_X,
      entry: "gateway/resolver.ts",
      handler: "lambdaHandler",
      tracing: lambda.Tracing.ACTIVE,

      timeout: Duration.seconds(3),

      bundling: {
        minify: true,
        banner: "/* Marcus Sms Bot - minified and bundled. */",
      },

      environment: {
        MARCUS_REGION: "us-east-1",
        MARCUS_LIST_BUCKET_NAME: listBucket.bucketName,
      },
    });
    listBucket.grantReadWrite(smsResolverLambda);

    /* Provide access to our SMS resolver lambda. */
    const api = new apigateway.RestApi(this, "SmsGatewayApi", {
      restApiName: "MarcusSmsGatewayApi",
      disableExecuteApiEndpoint: false,
    });
    const receiveSms = api.root.addResource("receiveSms");
    receiveSms.addMethod("POST", new apigateway.LambdaIntegration(smsResolverLambda));
  }
}
