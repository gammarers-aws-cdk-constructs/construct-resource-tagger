import { CfnResource, IAspect, Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/** Configuration for {@link ConstructResourceTagger}. */
export interface ConstructResourceTaggerProps {
  /**
   * CloudFormation type name of target L1 resources
   * (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`).
   */
  readonly resourceType: string;
  /** Key-value pairs applied to each matching resource. */
  readonly tags: Record<string, string>;
  /**
   * Optional construct path substring; when set, only nodes whose
   * {@link IConstruct.node | node.path} includes this value are tagged.
   */
  readonly pathFilter?: string;
}

/**
 * CDK aspect that applies tags to L1 resources of a given type.
 *
 * Register with `Aspects.of(scope).add(new ConstructResourceTagger({ ... }))`
 * to tag matching {@link CfnResource} instances during synthesis.
 */
export class ConstructResourceTagger implements IAspect {
  private readonly resourceType: string;
  private readonly tags: Record<string, string>;
  private readonly pathFilter?: string;

  /**
   * @param props - Resource type, tags, and optional path filter.
   */
  constructor(props: ConstructResourceTaggerProps) {
    this.resourceType = props.resourceType;
    this.tags = props.tags;
    this.pathFilter = props.pathFilter;
  }

  /**
   * Applies configured tags when `node` is an L1 resource whose CloudFormation
   * type matches `resourceType` and optionally matches `pathFilter`.
   *
   * @param node - Construct visited during aspect traversal.
   */
  visit(node: IConstruct): void {
    if (
      CfnResource.isCfnResource(node) &&
      node.cfnResourceType === this.resourceType
    ) {
      if (!this.pathFilter || node.node.path.includes(this.pathFilter)) {
        Object.entries(this.tags).forEach(([key, value]) => {
          Tags.of(node).add(key, value);
        });
      }
    }
  }
}
