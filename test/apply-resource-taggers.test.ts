import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnQueue } from 'aws-cdk-lib/aws-sqs';
import { ConstructResourceTagger } from '../src';

const tagMatch = (key: string, value: string) =>
  Match.objectLike({ Key: key, Value: value });

const bucketTagger = (tags: Record<string, string>): ConstructResourceTagger =>
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags,
  });

describe('ConstructResourceTagger.apply', () => {
  test('should apply each tagger on a single scope', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    ConstructResourceTagger.apply({
      scopes: [stack],
      taggers: [
        bucketTagger({ env: 'prod' }),
        new ConstructResourceTagger({
          resourceTypes: [CfnQueue.CFN_RESOURCE_TYPE_NAME],
          tags: { team: 'platform' },
        }),
      ],
    });

    new CfnBucket(stack, 'Bucket', {
      bucketName: 'apply-resource-taggers-bucket',
    });
    new CfnQueue(stack, 'Queue', {});

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'prod')]),
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      Tags: Match.arrayWith([tagMatch('team', 'platform')]),
    });
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('team', 'platform')]) },
      0,
    );
  });

  test('should register the same taggers on each scope', () => {
    const app = new App();
    const prod = new Stack(app, 'Prod');
    const staging = new Stack(app, 'Staging');

    ConstructResourceTagger.apply({
      scopes: [prod, staging],
      taggers: [bucketTagger({ owner: 'platform' })],
    });

    new CfnBucket(prod, 'Bucket', {
      bucketName: 'apply-resource-taggers-prod',
    });
    new CfnBucket(staging, 'Bucket', {
      bucketName: 'apply-resource-taggers-staging',
    });

    for (const stack of [prod, staging]) {
      Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
        Tags: Match.arrayWith([tagMatch('owner', 'platform')]),
      });
    }
  });

  test('should let the later tagger overwrite the same key', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    ConstructResourceTagger.apply({
      scopes: [stack],
      taggers: [
        bucketTagger({ env: 'first' }),
        bucketTagger({ env: 'second' }),
      ],
    });

    new CfnBucket(stack, 'Bucket', {
      bucketName: 'apply-resource-taggers-overwrite',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'second')]),
    });
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('env', 'first')]) },
      0,
    );
  });

  test('should throw when scopes is empty', () => {
    expect(() =>
      ConstructResourceTagger.apply({
        scopes: [],
        taggers: [bucketTagger({ env: 'prod' })],
      }),
    ).toThrow('scopes must contain at least one scope.');
  });

  test('should throw when taggers is empty', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    expect(() =>
      ConstructResourceTagger.apply({
        scopes: [stack],
        taggers: [],
      }),
    ).toThrow('taggers must contain at least one tagger.');
  });
});
