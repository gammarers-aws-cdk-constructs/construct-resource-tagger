import { App, Aspects, Stack, TagManager, Tags } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CfnAutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { CfnVPC } from 'aws-cdk-lib/aws-ec2';
import { CfnPolicy, CfnRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket, CfnBucket, CfnBucketPolicy } from 'aws-cdk-lib/aws-s3';
import { CfnQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { ConstructResourceTagger, IPathMatcher, PathMatcher } from '../src';

const tagMatch = (key: string, value: string) =>
  Match.objectLike({ Key: key, Value: value });

const LAMBDA_ASSUME_ROLE_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'lambda.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
};

const synthWithAspects = (
  configure: (stack: Stack) => void,
  ...taggers: ConstructResourceTagger[]
): Template => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');
  taggers.forEach((tagger) => {
    Aspects.of(stack).add(tagger);
  });
  configure(stack);
  return Template.fromStack(stack);
};

const synth = (
  configure: (stack: Stack) => void,
  taggerProps: ConstructorParameters<typeof ConstructResourceTagger>[0],
): Template => synthWithAspects(configure, new ConstructResourceTagger(taggerProps));

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

  test('should tag only resources whose construct path matches pathFilter at segment boundaries', () => {
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

  test('should not tag resources when pathFilter is only a substring of a path segment', () => {
    const template = synth(
      (stack) => {
        const nonProd = new Construct(stack, 'NonProd');
        new CfnBucket(nonProd, 'NonProdBucket', {
          bucketName: 'construct-resource-tagger-nonprod',
        });
        const prod = new Construct(stack, 'Prod');
        new CfnBucket(prod, 'ProdBucket', {
          bucketName: 'construct-resource-tagger-prod',
        });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
        pathFilter: 'Prod',
      },
    );

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('env', 'prod')]) },
      1,
    );
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.absent() },
      1,
    );
  });

  test('should tag resources whose construct path matches a PathMatcher pattern', () => {
    const template = synth(
      (stack) => {
        const nonProd = new Construct(stack, 'NonProd');
        new CfnBucket(nonProd, 'NonProdBucket', {
          bucketName: 'construct-resource-tagger-pattern-nonprod',
        });
        const prod = new Construct(stack, 'Prod');
        new CfnBucket(prod, 'ProdBucket', {
          bucketName: 'construct-resource-tagger-pattern-prod',
        });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
        pathMatcher: PathMatcher.pattern('(^|/)Prod(/|$)'),
      },
    );

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('env', 'prod')]) },
      1,
    );
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.absent() },
      1,
    );
  });

  test('should tag resources matching a custom pathMatcher predicate', () => {
    const matcher: IPathMatcher = {
      matches: (node) => node.node.scope?.node.id === 'Keep',
    };

    const template = synth(
      (stack) => {
        const skip = new Construct(stack, 'Skip');
        new CfnBucket(skip, 'SkippedBucket', {
          bucketName: 'construct-resource-tagger-skip',
        });
        const keep = new Construct(stack, 'Keep');
        new CfnBucket(keep, 'KeptBucket', {
          bucketName: 'construct-resource-tagger-keep',
        });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { scoped: 'yes' },
        pathMatcher: matcher,
      },
    );

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('scoped', 'yes')]) },
      1,
    );
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.absent() },
      1,
    );
  });

  test('should throw when both pathFilter and pathMatcher are set', () => {
    expect(
      () =>
        new ConstructResourceTagger({
          resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
          tags: { env: 'prod' },
          pathFilter: 'Prod',
          pathMatcher: PathMatcher.prefix('Prod'),
        }),
    ).toThrow('Specify only one of pathFilter or pathMatcher.');
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

  test('should overwrite lower-priority tags when tagProps.priority is higher', () => {
    const template = synth(
      (stack) => {
        const bucket = new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-priority-high',
        });
        Tags.of(bucket).add('env', 'existing', { priority: 100 });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'policy' },
        tagProps: { priority: 300 },
      },
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'policy')]),
    });
  });

  test('should keep higher-priority tags when tagProps.priority is lower', () => {
    const template = synth(
      (stack) => {
        const bucket = new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-priority-low',
        });
        Tags.of(bucket).add('env', 'existing', { priority: 300 });
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'policy' },
        tagProps: { priority: 100 },
      },
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'existing')]),
    });
  });

  test('should forward applyToLaunchedInstances via tagProps', () => {
    const template = synth(
      (stack) => {
        new CfnAutoScalingGroup(stack, 'Asg', {
          maxSize: '1',
          minSize: '1',
          launchTemplate: {
            launchTemplateId: 'lt-construct-resource-tagger',
            version: '1',
          },
        });
      },
      {
        resourceTypes: [CfnAutoScalingGroup.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
        tagProps: { applyToLaunchedInstances: false },
      },
    );

    template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'env',
          Value: 'prod',
          PropagateAtLaunch: false,
        }),
      ]),
    });
  });

  test('should keep unrelated existing tags when overwriting a conflicting key', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-keep-unrelated',
          tags: [
            { key: 'env', value: 'manual' },
            { key: 'owner', value: 'alice' },
          ],
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
        tagMatch('owner', 'alice'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should keep unrelated existing tags when overwrite is false', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-keep-unrelated-no-overwrite',
          tags: [
            { key: 'env', value: 'manual' },
            { key: 'owner', value: 'alice' },
          ],
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
        tagMatch('owner', 'alice'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should synthesize without Tags when the configured resource type is not taggable', () => {
    const template = synth(
      (stack) => {
        new CfnPolicy(stack, 'Policy', {
          policyName: 'construct-resource-tagger-untaggable',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              { Effect: 'Allow', Action: 's3:ListBucket', Resource: '*' },
            ],
          },
        });
      },
      {
        resourceTypes: [CfnPolicy.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
      },
    );

    template.resourceCountIs('AWS::IAM::Policy', 1);
    template.hasResourceProperties('AWS::IAM::Policy', {
      Tags: Match.absent(),
    });
  });

  test('should tag taggable resources and skip untaggable ones in the same stack', () => {
    const template = synth(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-mixed-taggable',
        });
        new CfnBucketPolicy(stack, 'Policy', {
          bucket: 'construct-resource-tagger-mixed-taggable',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              { Effect: 'Allow', Action: 's3:GetObject', Resource: '*' },
            ],
          },
        });
      },
      {
        resourceTypes: [
          CfnBucket.CFN_RESOURCE_TYPE_NAME,
          CfnBucketPolicy.CFN_RESOURCE_TYPE_NAME,
        ],
        tags: { env: 'prod' },
      },
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'prod')]),
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      Tags: Match.absent(),
    });
  });

  test('should tag the L1 IAM Role created by an L2 Role construct', () => {
    const template = synth(
      (stack) => {
        new Role(stack, 'FnRole', {
          assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        });
      },
      {
        resourceTypes: [CfnRole.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
      },
    );

    template.hasResourceProperties('AWS::IAM::Role', {
      Tags: Match.arrayWith([tagMatch('env', 'prod')]),
    });
  });

  test('should tag L1 resources created by a custom construct', () => {
    class NestedIamResources extends Construct {
      constructor(scope: Construct, id: string) {
        super(scope, id);
        new CfnRole(this, 'Role', {
          assumeRolePolicyDocument: LAMBDA_ASSUME_ROLE_POLICY,
        });
      }
    }

    const template = synth(
      (stack) => {
        new NestedIamResources(stack, 'Workload');
      },
      {
        resourceTypes: [CfnRole.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
      },
    );

    template.hasResourceProperties('AWS::IAM::Role', {
      Tags: Match.arrayWith([tagMatch('env', 'prod')]),
    });
  });

  test('should tag the L1 bucket created by an L2 Bucket construct', () => {
    const template = synth(
      (stack) => {
        new Bucket(stack, 'L2Bucket');
      },
      {
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
      },
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'prod')]),
    });
  });

  test('should apply tags from multiple aspects when keys differ', () => {
    const template = synthWithAspects(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-multi-aspect-keys',
        });
      },
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
      }),
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { team: 'platform' },
      }),
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        tagMatch('env', 'prod'),
        tagMatch('team', 'platform'),
      ]),
    });
  });

  test('should let the later aspect win when both overwrite the same key', () => {
    const template = synthWithAspects(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-multi-aspect-overwrite',
        });
      },
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'first' },
      }),
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'second' },
      }),
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'second')]),
    });
    template.resourcePropertiesCountIs(
      'AWS::S3::Bucket',
      { Tags: Match.arrayWith([tagMatch('env', 'first')]) },
      0,
    );
  });

  test('should let the higher-priority aspect win regardless of registration order', () => {
    const template = synthWithAspects(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tagger-multi-aspect-priority',
        });
      },
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'first' },
        tagProps: { priority: 300 },
      }),
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'second' },
        tagProps: { priority: 100 },
      }),
    );

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([tagMatch('env', 'first')]),
    });
  });
});
