import { App, Aspects, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CfnVPC } from 'aws-cdk-lib/aws-ec2';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ConstructResourceTagger } from '../src';

const tagMatch = (key: string, value: string) =>
  Match.objectLike({ Key: key, Value: value });

function synth(
  configure: (stack: Stack) => void,
  taggerProps: ConstructorParameters<typeof ConstructResourceTagger>[0],
): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack');
  Aspects.of(stack).add(new ConstructResourceTagger(taggerProps));
  configure(stack);
  return Template.fromStack(stack);
}

describe('ConstructResourceTagger', () => {
  test('should apply tags to L1 resources of the configured type', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-prod',
        });
      },
      {
        resourceType: CfnBucket.CFN_RESOURCE_TYPE_NAME,
        tags: { env: 'prod', team: 'platform' },
      },
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        tagMatch('env', 'prod'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should not tag L1 resources of other types', () => {
    const template = synth(
      (stack) => {
        new CfnVPC(stack, 'Vpc', { cidrBlock: '10.0.0.0/16' });
      },
      {
        resourceType: CfnBucket.CFN_RESOURCE_TYPE_NAME,
        tags: { env: 'prod' },
      },
    );

    template.hasResourceProperties('AWS::EC2::VPC', {
      Tags: Match.absent(),
    });
  });

  test('should tag only resources whose construct path includes pathFilter', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Outside', {
          bucketName: 'construct-resource-tagger-outside',
        });
        const nested = new Construct(stack, 'Filtered');
        new CfnBucket(nested, 'Inside', {
          bucketName: 'construct-resource-tagger-inside',
        });
      },
      {
        resourceType: CfnBucket.CFN_RESOURCE_TYPE_NAME,
        tags: { scoped: 'yes' },
        pathFilter: 'Filtered',
      },
    );

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.absent() },
      1,
    );
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('scoped', 'yes')]) },
      1,
    );
  });

  test('should tag all matching resources when pathFilter is omitted', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'One', {
          bucketName: 'construct-resource-tagger-one',
        });
        const nested = new Construct(stack, 'Nested');
        new CfnBucket(nested, 'Two', {
          bucketName: 'construct-resource-tagger-two',
        });
      },
      {
        resourceType: CfnBucket.CFN_RESOURCE_TYPE_NAME,
        tags: { env: 'dev' },
      },
    );

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('env', 'dev')]) },
      2,
    );
  });
});
