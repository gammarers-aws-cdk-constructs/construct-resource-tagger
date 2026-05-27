# Construct Resource Tagger (AWS CDK V2)

[![npm version](https://img.shields.io/npm/v/construct-resource-tagger.svg)](https://www.npmjs.com/package/construct-resource-tagger)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

AWS CDK aspect that applies tags to L1 (`CfnResource`) resources of a given type during synthesis.

## Features

- Tag all L1 resources that match a CloudFormation resource type name
- Apply multiple key-value tags in one aspect
- Optionally restrict tagging to constructs whose path includes a substring (`pathFilter`)
- Register once on a scope with `Aspects.of(scope).add(...)`

## Installation

```bash
npm install construct-resource-tagger
```

```bash
yarn add construct-resource-tagger
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
    resourceType: CfnBucket.CFN_RESOURCE_TYPE_NAME,
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

### Scoped tagging with `pathFilter`

When you only want to tag resources under a specific part of the construct tree, set `pathFilter` to a substring of `node.path`:

```typescript
import { Construct } from 'constructs';

const nested = new Construct(stack, 'DataPlane');

Aspects.of(stack).add(
  new ConstructResourceTagger({
    resourceType: CfnBucket.CFN_RESOURCE_TYPE_NAME,
    tags: { tier: 'data' },
    pathFilter: 'DataPlane',
  }),
);

new CfnBucket(stack, 'Outside', { bucketName: 'outside-bucket' }); // not tagged
new CfnBucket(nested, 'Inside', { bucketName: 'inside-bucket' }); // tagged
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `resourceType` | `string` | Yes | CloudFormation type name (for example `CfnBucket.CFN_RESOURCE_TYPE_NAME`) |
| `tags` | `Record<string, string>` | Yes | Tag key-value pairs applied to each matching resource |
| `pathFilter` | `string` | No | When set, only resources whose construct path includes this substring are tagged |

## Requirements

- Node.js `>= 20.0.0`
- `aws-cdk-lib` `^2.232.0`
- `constructs` `^10.5.1`

## License

This project is licensed under the Apache-2.0 License.
