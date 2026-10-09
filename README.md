# Construct Resource Tagger (CDK v2)

[![npm version](https://img.shields.io/npm/v/construct-resource-tagger?style=flat-square)](https://www.npmjs.com/package/construct-resource-tagger)
[![license](https://img.shields.io/npm/l/construct-resource-tagger?style=flat-square)](https://www.npmjs.com/package/construct-resource-tagger)
[![Node.js](https://img.shields.io/node/v/construct-resource-tagger?style=flat-square)](https://www.npmjs.com/package/construct-resource-tagger)
[![build](https://img.shields.io/github/actions/workflow/status/gammarers-aws-cdk-constructs/construct-resource-tagger/build.yml?label=build&style=flat-square)](https://github.com/gammarers-aws-cdk-constructs/construct-resource-tagger/actions/workflows/build.yml)

[![View on Construct Hub](https://constructs.dev/badge?package=construct-resource-tagger)](https://constructs.dev/packages/construct-resource-tagger)

AWS CDK aspect that applies tags to matching L1 (`CfnResource`) resources during synthesis.

## Features

- Tag L1 resources that match one or more CloudFormation resource type names
- Apply multiple key-value tags in a single aspect registration
- Derive tag values from each matching construct, such as stack name, construct ID, or path
- Optionally restrict tagging by construct path prefix (`pathFilter`), regular expression, or a custom predicate (`pathMatcher`)
- Control whether existing tag keys are overwritten (`overwrite`)
- Forward CDK `TagProps` such as `priority` and `applyToLaunchedInstances` (`tagProps`)
- Register once on a scope with `Aspects.of(scope).add(...)`

## How it works

Register `ConstructResourceTagger` on a scope with `Aspects.of(scope).add(...)`. During synthesis, CDK visits each construct in that scope. The aspect applies tags when the construct is an L1 resource whose CloudFormation type is listed in `resourceTypes` and, when set, whose path matches `pathFilter` or `pathMatcher`. Tag values come from a fixed map or from a function of that construct. Existing keys are replaced unless `overwrite` is `false`. Each applied tag is added with `Tags.of(node).add`, including any `tagProps`.

## Installation

### npm

```bash
npm install construct-resource-tagger
```

### yarn

```bash
yarn add construct-resource-tagger
```

### pnpm

```bash
pnpm add construct-resource-tagger
```

`aws-cdk-lib` and `constructs` are peer dependencies and must be installed in your project.

## Usage

```typescript
import { App, Aspects, Stack } from 'aws-cdk-lib';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { ConstructResourceTagger } from 'construct-resource-tagger';

const app = new App();
const stack = new Stack(app, 'MyStack');

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: {
      env: 'prod',
      team: 'platform',
    },
  }),
);

new CfnBucket(stack, 'Bucket', {
  bucketName: 'my-example-bucket',
});
```

### Dynamic tag values

Pass a function as `tags` to derive values from each matching construct. The function is called once per L1 resource that passes the resource type and path filters:

```typescript
import { Aspects, Stack } from 'aws-cdk-lib';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { ConstructResourceTagger } from 'construct-resource-tagger';

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: (node) => ({
      stack: Stack.of(node).stackName,
      id: node.node.id,
      path: node.node.path,
    }),
  }),
);
```

### Multiple resource types

Pass multiple CloudFormation type names when the same tags should apply to several L1 resource types:

```typescript
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnQueue } from 'aws-cdk-lib/aws-sqs';

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [
      CfnBucket.CFN_RESOURCE_TYPE_NAME,
      CfnTable.CFN_RESOURCE_TYPE_NAME,
      CfnQueue.CFN_RESOURCE_TYPE_NAME,
    ],
    tags: {
      env: 'prod',
      team: 'platform',
    },
  }),
);
```

### Scoped tagging with `pathFilter`

When you only want to tag resources under a specific part of the construct tree, set `pathFilter` to a path prefix matched at `/`-delimited segment boundaries. `"Prod"` matches `MyStack/Prod` and `MyStack/Prod/Bucket`, but not `MyStack/NonProd`:

```typescript
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

const nested = new Construct(stack, 'DataPlane');

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: { tier: 'data' },
    pathFilter: 'DataPlane',
  }),
);

new CfnBucket(stack, 'Outside', { bucketName: 'outside-bucket' }); // not tagged
new CfnBucket(nested, 'Inside', { bucketName: 'inside-bucket' }); // tagged
```

### Regular expressions and custom predicates with `pathMatcher`

For matching that a path prefix cannot express, pass `pathMatcher` instead of `pathFilter` (the two options cannot be combined).

```typescript
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { ConstructResourceTagger, PathMatcher } from 'construct-resource-tagger';

// Regular expression against node.path
Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: { env: 'prod' },
    pathMatcher: PathMatcher.pattern('(^|/)Prod(/|$)'),
  }),
);

// Custom predicate
Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: { tier: 'data' },
    pathMatcher: {
      matches: (node) => node.node.scope?.node.id === 'DataPlane',
    },
  }),
);
```

### Respecting existing tags

By default, configured tags overwrite existing keys with the same name. Set `overwrite: false` to keep manually defined tags and add only missing keys:

```typescript
import { CfnBucket } from 'aws-cdk-lib/aws-s3';

new CfnBucket(stack, 'Bucket', {
  bucketName: 'my-example-bucket',
  tags: [{ key: 'env', value: 'staging' }],
});

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: { env: 'prod', team: 'platform' },
    overwrite: false,
  }),
);

// env stays "staging"; team is added as "platform"
```

### Tag priority and other `TagProps`

Pass CDK [`TagProps`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.TagProps.html) through `tagProps`. Use `priority` when organizational policies must win over lower-priority tags, or set `applyToLaunchedInstances` for Auto Scaling groups:

```typescript
import { CfnAutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnBucket.CFN_RESOURCE_TYPE_NAME],
    tags: { env: 'prod' },
    tagProps: { priority: 300 },
  }),
);

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceTypes: [CfnAutoScalingGroup.CFN_RESOURCE_TYPE_NAME],
    tags: { env: 'prod' },
    tagProps: { applyToLaunchedInstances: false },
  }),
);
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `resourceTypes` | `string[]` | Yes | CloudFormation type names (for example `CfnBucket.CFN_RESOURCE_TYPE_NAME`). Must contain at least one entry. |
| `tags` | `Record<string, string> \| ConstructResourceTagValues` | Yes | Tag key-value pairs, or a function called once per matching resource. The function receives the construct so values can use stack name, construct ID, or path |
| `pathFilter` | `string` | No | When set, only resources whose construct path matches this prefix at `/`-delimited segment boundaries are tagged. Cannot be combined with `pathMatcher`. |
| `pathMatcher` | `IPathMatcher` | No | Custom path matcher (`PathMatcher.pattern(...)` or `{ matches: (node) => boolean }`). Cannot be combined with `pathFilter`. |
| `overwrite` | `boolean` | No | When `false`, skip tag keys that already exist on the resource (default: `true`) |
| `tagProps` | `TagProps` | No | Options forwarded to `Tags.of(node).add(...)`, such as `priority` and `applyToLaunchedInstances` |

## API

See [API.md](./API.md).

## Requirements

- Node.js `>= 20.0.0`
- `aws-cdk-lib` `^2.232.0`
- `constructs` `^10.5.1`

## License

This project is licensed under the Apache-2.0 License.
