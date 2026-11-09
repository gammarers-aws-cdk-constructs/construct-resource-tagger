import { ProjenCdkConstructLibrary } from '@gammarers/projen-projects';
const project = new ProjenCdkConstructLibrary({
  releaseToNpm: true,
  npmTrustedPublishing: true,
  cdkVersion: '2.232.0',
  name: 'construct-resource-tagger',
  repository: 'https://github.com/gammarers-aws-cdk-constructs/construct-resource-tagger.git',
  description: 'AWS CDK aspects that apply tags to matching L1 (CfnResource) resources and report missing required tag keys during synthesis.',
  keywords: [
    'cdk',
    'aws',
    'aws-cdk',
    'aspect',
    'tag',
  ],
  devDeps: [
    '@gammarers/projen-projects@^0.2.1',
  ],
  jestOptions: {
    extraCliOptions: ['--silent'],
  },
});
project.addPackageIgnore('/.devcontainer');
project.synth();