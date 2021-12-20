#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MarcusStack } from "../lib/marcus-stack";

const app = new cdk.App();
new MarcusStack(app, "MarcusStack", {
  env: {
    account: "987352247039",
    region: "us-east-1",
  },
});
