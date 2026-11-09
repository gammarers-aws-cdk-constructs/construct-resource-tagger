import { Annotations, CfnResource, IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { readExistingTagKeys } from './existing-tag-keys';
import { IPathMatcher, PathMatcher } from './path-matcher';

/** Configuration for {@link ConstructResourceTagValidator}. */
export interface ConstructResourceTagValidatorProps {
  /**
   * CloudFormation type names of target L1 resources
   * (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`).
   * Must contain at least one entry.
   */
  readonly resourceTypes: string[];
  /**
   * Tag keys that must be present on each matching L1 resource.
   * Values are not checked. Must contain at least one entry.
   */
  readonly requiredTagKeys: string[];
  /**
   * Optional construct path prefix matched at `/`-delimited segment
   * boundaries. `"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`,
   * but not `Stack/NonProd`.
   *
   * Cannot be combined with {@link pathMatcher}.
   *
   * @see PathMatcher.prefix
   */
  readonly pathFilter?: string;
  /**
   * Optional matcher that decides whether a construct should be checked.
   * Use {@link PathMatcher.pattern} for regular expressions, or implement
   * {@link IPathMatcher} for a custom predicate.
   *
   * Cannot be combined with {@link pathFilter}.
   */
  readonly pathMatcher?: IPathMatcher;
}

/**
 * CDK aspect that reports missing required tag keys on matching L1 resources.
 *
 * Register with `Aspects.of(scope).add(new ConstructResourceTagValidator({ ... }))`
 * after taggers when those taggers should satisfy the check. This aspect does
 * not apply tags. A missing key, or tags that cannot be read, adds an error
 * annotation and synthesis fails.
 */
export class ConstructResourceTagValidator implements IAspect {
  private readonly resourceTypes: ReadonlySet<string>;
  private readonly requiredTagKeys: readonly string[];
  private readonly pathMatcher?: IPathMatcher;

  /**
   * Creates a tag validator aspect from the given configuration.
   *
   * @param props - Resource types, required tag keys, and optional path filters.
   * @throws If `resourceTypes` is empty.
   * @throws If `requiredTagKeys` is empty.
   * @throws If both `pathFilter` and `pathMatcher` are set.
   */
  constructor(props: ConstructResourceTagValidatorProps) {
    if (props.resourceTypes.length === 0) {
      throw new Error('resourceTypes must contain at least one resource type.');
    }
    if (props.requiredTagKeys.length === 0) {
      throw new Error('requiredTagKeys must contain at least one tag key.');
    }
    if (props.pathFilter && props.pathMatcher !== undefined) {
      throw new Error('Specify only one of pathFilter or pathMatcher.');
    }

    this.resourceTypes = new Set(props.resourceTypes);
    this.requiredTagKeys = [...props.requiredTagKeys];
    let pathMatcher = props.pathMatcher;
    if (props.pathFilter) {
      pathMatcher = PathMatcher.prefix(props.pathFilter);
    }
    this.pathMatcher = pathMatcher;
  }

  /**
   * Reports missing required tag keys when `node` is an L1 resource whose
   * CloudFormation type matches a configured resource type and optionally
   * matches `pathFilter` or `pathMatcher`.
   *
   * @param node - Construct visited during aspect traversal.
   */
  visit(node: IConstruct): void {
    if (!CfnResource.isCfnResource(node)) {
      return;
    }
    if (!this.resourceTypes.has(node.cfnResourceType)) {
      return;
    }
    if (this.pathMatcher && !this.pathMatcher.matches(node)) {
      return;
    }

    const read = readExistingTagKeys(node);
    if (read.kind === 'unreadable') {
      Annotations.of(node).addError('Cannot read tags to verify required tag keys.');
      return;
    }

    for (const key of this.requiredTagKeys) {
      if (read.keys.has(key)) {
        continue;
      }
      Annotations.of(node).addError(`Missing required tag key "${key}".`);
    }
  }
}
