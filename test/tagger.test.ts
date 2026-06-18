import { App, Aspects, Stack, TagManager } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { CfnVPC } from 'aws-cdk-lib/aws-ec2';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnQueue } from 'aws-cdk-lib/aws-sqs';
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
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
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
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
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
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
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

  test('should apply tags to multiple configured resource types', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-bucket',
        });
        new CfnTable(stack, 'Table', {
          tableName: 'construct-resource-tagger-table',
          attributeDefinitions: [
            { attributeName: 'id', attributeType: 'S' },
          ],
          keySchema: [{ attributeName: 'id', keyType: 'HASH' }],
          billingMode: 'PAY_PER_REQUEST',
        });
        new CfnQueue(stack, 'Queue', {});
        new CfnVPC(stack, 'Vpc', { cidrBlock: '10.0.0.0/16' });
      },
      {
        resourceTypes: [
          CfnBucket.CFN_RESOURCE_TYPE_NAME,
          CfnTable.CFN_RESOURCE_TYPE_NAME,
          CfnQueue.CFN_RESOURCE_TYPE_NAME,
        ],
        tags: { env: 'prod', team: 'platform' },
      },
    );

    for (const resourceType of [
      'AWS::S3::Bucket',
      'AWS::DynamoDB::Table',
      'AWS::SQS::Queue',
    ]) {
      template.hasResourceProperties(resourceType, {
        Tags: Match.arrayWith([
          tagMatch('env', 'prod'),
          tagMatch('team', 'platform'),
        ]),
      });
    }

    template.hasResourceProperties('AWS::EC2::VPC', {
      Tags: Match.absent(),
    });
  });

  test('should throw when resourceTypes is empty', () => {
    expect(
      () =>
        new ConstructResourceTagger({
          resourceTypes: [],
          tags: { env: 'prod' },
        }),
    ).toThrow('resourceTypes must contain at least one resource type.');
  });

  test('should overwrite existing tags by default', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-overwrite-default',
          tags: [{ key: 'env', value: 'manual' }],
        });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
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

  test('should skip existing tag keys when overwrite is false', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-skip-existing',
          tags: [{ key: 'env', value: 'manual' }],
        });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod', team: 'platform' },
        overwrite: false,
      },
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        tagMatch('env', 'manual'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should skip existing tags in CloudFormation Key format when overwrite is false', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of');

    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-cfn-key-format',
        });
        tagManagerOfSpy.mockReturnValue({
          renderTags: () => [{ Key: 'env', Value: 'manual' }],
        } as unknown as TagManager);
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod', team: 'platform' },
        overwrite: false,
      },
    );

    tagManagerOfSpy.mockRestore();

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('team', 'platform')]),
    });
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('env', 'prod')]) },
      0,
    );
  });

  test('should apply all tags when overwrite is false and tag manager is unavailable', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of').mockReturnValue(undefined);

    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-no-tag-manager',
        });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod', team: 'platform' },
        overwrite: false,
      },
    );

    tagManagerOfSpy.mockRestore();

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        tagMatch('env', 'prod'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should apply all tags when overwrite is false and rendered tags are not an array', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of');

    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-non-array-tags',
        });
        tagManagerOfSpy.mockReturnValue({
          renderTags: () => ({ Key: 'env', Value: 'manual' }),
        } as unknown as TagManager);
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod', team: 'platform' },
        overwrite: false,
      },
    );

    tagManagerOfSpy.mockRestore();

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        tagMatch('env', 'prod'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should ignore unrecognized rendered tag entries when overwrite is false', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of');

    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-unrecognized-tags',
        });
        tagManagerOfSpy.mockReturnValue({
          renderTags: () => [null, 'invalid', { other: 'value' }],
        } as unknown as TagManager);
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod', team: 'platform' },
        overwrite: false,
      },
    );

    tagManagerOfSpy.mockRestore();

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        tagMatch('env', 'prod'),
        tagMatch('team', 'platform'),
      ]),
    });
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
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
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
