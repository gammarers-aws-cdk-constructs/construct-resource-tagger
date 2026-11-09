import { App, Aspects, Stack, TagManager } from 'aws-cdk-lib';
import { Annotations as AssertionAnnotations, Template } from 'aws-cdk-lib/assertions';
import { CfnVPC } from 'aws-cdk-lib/aws-ec2';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import {
  ConstructResourceTagger,
  ConstructResourceTagValidator,
  PathMatcher,
} from '../src';

const asTagManager = (
  tagManager: { renderTags: () => unknown },
): TagManager =>
  // TagManager has no factory for a renderTags-only double.
  tagManager as unknown as TagManager;

const validator = (
  requiredTagKeys: string[],
  extra: Partial<ConstructorParameters<typeof ConstructResourceTagValidator>[0]> = {},
): ConstructResourceTagValidator =>
  new ConstructResourceTagValidator({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    requiredTagKeys,
    ...extra,
  });

const annotationsFor = (
  configure: (stack: Stack) => void,
  aspect: ConstructResourceTagValidator,
): AssertionAnnotations => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');
  Aspects.of(stack).add(aspect);
  configure(stack);
  return AssertionAnnotations.fromStack(stack);
};

describe('ConstructResourceTagValidator', () => {
  test('should allow synthesis when every required tag key is present', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    Aspects.of(stack).add(validator(['env', 'team']));
    new CfnBucket(stack, 'Bucket', {
      bucketName: 'construct-resource-tag-validator-present',
      tags: [
        { key: 'env', value: 'prod' },
        { key: 'team', value: 'platform' },
      ],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: [
        { Key: 'env', Value: 'prod' },
        { Key: 'team', Value: 'platform' },
      ],
    });
  });

  test('should report each missing required tag key', () => {
    const annotations = annotationsFor(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tag-validator-missing',
        });
      },
      validator(['env', 'team']),
    );

    annotations.hasError('/TestStack/Bucket', 'Missing required tag key "env".');
    annotations.hasError('/TestStack/Bucket', 'Missing required tag key "team".');
  });

  test('should not report tag keys that are already present', () => {
    const annotations = annotationsFor(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tag-validator-partial',
          tags: [{ key: 'env', value: 'staging' }],
        });
      },
      validator(['env', 'team']),
    );

    annotations.hasNoError('/TestStack/Bucket', 'Missing required tag key "env".');
    annotations.hasError('/TestStack/Bucket', 'Missing required tag key "team".');
  });

  test('should ignore L1 resources of other types', () => {
    const annotations = annotationsFor(
      (stack) => {
        new CfnVPC(stack, 'Vpc', { cidrBlock: '10.0.0.0/16' });
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tag-validator-other-type',
        });
      },
      validator(['env']),
    );

    annotations.hasNoError('/TestStack/Vpc', 'Missing required tag key "env".');
    annotations.hasError('/TestStack/Bucket', 'Missing required tag key "env".');
  });

  test('should report only resources whose construct path matches pathFilter', () => {
    const annotations = annotationsFor(
      (stack) => {
        new CfnBucket(stack, 'Outside', {
          bucketName: 'construct-resource-tag-validator-outside',
        });
        const nested = new Construct(stack, 'Filtered');
        new CfnBucket(nested, 'Inside', {
          bucketName: 'construct-resource-tag-validator-inside',
        });
      },
      validator(['env'], { pathFilter: 'Filtered' }),
    );

    annotations.hasNoError('/TestStack/Outside', 'Missing required tag key "env".');
    annotations.hasError(
      '/TestStack/Filtered/Inside',
      'Missing required tag key "env".',
    );
  });

  test('should throw when requiredTagKeys is empty', () => {
    expect(() => validator([])).toThrow(
      'requiredTagKeys must contain at least one tag key.',
    );
  });

  test('should throw when resourceTypes is empty', () => {
    expect(
      () =>
        new ConstructResourceTagValidator({
          resourceTypes: [],
          requiredTagKeys: ['env'],
        }),
    ).toThrow('resourceTypes must contain at least one resource type.');
  });

  test('should throw when both pathFilter and pathMatcher are set', () => {
    expect(
      () =>
        validator(['env'], {
          pathFilter: 'Prod',
          pathMatcher: PathMatcher.prefix('Prod'),
        }),
    ).toThrow('Specify only one of pathFilter or pathMatcher.');
  });

  test('should see tags applied by an earlier tagger', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    Aspects.of(stack).add(
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod', team: 'platform' },
      }),
    );
    Aspects.of(stack).add(validator(['env', 'team']));
    new CfnBucket(stack, 'Bucket', {
      bucketName: 'construct-resource-tag-validator-after-tagger',
    });

    Template.fromStack(stack);
  });

  test('should not see tags applied by a later tagger', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    Aspects.of(stack).add(validator(['env']));
    Aspects.of(stack).add(
      new ConstructResourceTagger({
        resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
        tags: { env: 'prod' },
      }),
    );
    new CfnBucket(stack, 'Bucket', {
      bucketName: 'construct-resource-tag-validator-before-tagger',
    });

    AssertionAnnotations.fromStack(stack).hasError(
      '/TestStack/Bucket',
      'Missing required tag key "env".',
    );
  });

  test('should report an error when tags cannot be read', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of').mockReturnValue(undefined);

    const annotations = annotationsFor(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tag-validator-unreadable',
        });
      },
      validator(['env']),
    );

    tagManagerOfSpy.mockRestore();

    annotations.hasError(
      '/TestStack/Bucket',
      'Cannot read tags to verify required tag keys.',
    );
    annotations.hasNoError('/TestStack/Bucket', 'Missing required tag key "env".');
  });

  test('should rethrow unexpected errors while reading tags', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of').mockImplementation(() => {
      throw new Error('unexpected');
    });

    try {
      expect(() =>
        annotationsFor(
          (stack) => {
            new CfnBucket(stack, 'Bucket', {
              bucketName: 'construct-resource-tag-validator-unexpected-read',
            });
          },
          validator(['env']),
        ),
      ).toThrow('unexpected');
    } finally {
      tagManagerOfSpy.mockRestore();
    }
  });

  test('should report an error when rendered tags are not an array', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of');

    const annotations = annotationsFor(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tag-validator-non-array',
        });
        tagManagerOfSpy.mockReturnValue(asTagManager({
          renderTags: () => ({ Key: 'env', Value: 'manual' }),
        }));
      },
      validator(['env']),
    );

    tagManagerOfSpy.mockRestore();

    annotations.hasError(
      '/TestStack/Bucket',
      'Cannot read tags to verify required tag keys.',
    );
    annotations.hasNoError('/TestStack/Bucket', 'Missing required tag key "env".');
  });

  test('should report missing keys when rendered tag entries are unrecognized', () => {
    const tagManagerOfSpy = jest.spyOn(TagManager, 'of');

    const annotations = annotationsFor(
      (stack) => {
        new CfnBucket(stack, 'Bucket', {
          bucketName: 'construct-resource-tag-validator-unrecognized',
        });
        tagManagerOfSpy.mockReturnValue(asTagManager({
          renderTags: () => [null, 'invalid', { other: 'value' }],
        }));
      },
      validator(['env']),
    );

    tagManagerOfSpy.mockRestore();

    annotations.hasError('/TestStack/Bucket', 'Missing required tag key "env".');
    annotations.hasNoError(
      '/TestStack/Bucket',
      'Cannot read tags to verify required tag keys.',
    );
  });
});
