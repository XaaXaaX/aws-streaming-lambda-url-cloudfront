#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StreamingResponseStack } from '../lib/cdk-stack';

const app = new cdk.App();
new StreamingResponseStack(app, StreamingResponseStack.name , {});