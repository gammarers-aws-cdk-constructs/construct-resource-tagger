import { Aspects, CfnResource, IAspect, TagProps, Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { readExistingTagKeys } from './existing-tag-keys';
import { IPathMatcher, PathMatcher } from './path-matcher';

/**
 * Builds tag key-value pairs for one matching construct.
 * Stack name, construct ID, and path are available on `node`.
 */
export interface ConstructResourceTagValues {
  /**
   * @param node - L1 resource that passed resource type and path filters.
   * @returns Tag key-value pairs applied to `node`.
   */
  (node: IConstruct): Record<string, string>;
}

/** Configuration for {@link ConstructResourceTagger.apply}. */
export interface ApplyResourceTaggersProps {
  /**
   * Scopes that receive every tagger.
   * Must contain at least one scope.
   */
  readonly scopes: IConstruct[];
  /**
   * Aspects registered on each scope, in array order.
   * A later tagger overwrites the same tag key when priorities are equal.
   * Must contain at least one tagger.
   */
  readonly taggers: ConstructResourceTagger[];
}

/** Configuration for {@link ConstructResourceTagger}. */
export interface ConstructResourceTaggerProps {
  /**
   * CloudFormation type names of target L1 resources
   * (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`).
   * Must contain at least one entry.
   */
  readonly resourceTypes: string[];
  /**
   * Tag key-value pairs applied to each matching resource, or a function
   * that returns them for that resource. The function runs once per L1
   * resource that passes the resource type and path filters.
   */
  readonly tags: Record<string, string> | ConstructResourceTagValues;
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
   * Optional matcher that decides whether a construct should be tagged.
   * Use {@link PathMatcher.pattern} for regular expressions, or implement
   * {@link IPathMatcher} for a custom predicate.
   *
   * Cannot be combined with {@link pathFilter}.
   */
  readonly pathMatcher?: IPathMatcher;
  /**
   * When `false`, tag keys that already exist on a resource are left unchanged
   * and only missing keys are added.
   *
   * @default true
   */
  readonly overwrite?: boolean;
  /**
   * Options forwarded to {@link Tags.add} for each applied tag,
   * such as `priority` and `applyToLaunchedInstances`.
   *
   * @see TagProps
   */
  readonly tagProps?: TagProps;
}

/**
 * Returns the tag map for `node`, invoking a callback when `tags` is a function.
 *
 * @param tags - Static tag map or a per-construct resolver.
 * @param node - Matching L1 resource.
 * @returns Tag key-value pairs to apply.
 */
const resolveTags = (
  tags: Record<string, string> | ConstructResourceTagValues,
  node: IConstruct,
): Record<string, string> => {
  if (typeof tags === 'function') {
    return tags(node);
  }
  return tags;
};

/**
 * CDK aspect that applies tags to L1 resources matching configured
 * CloudFormation resource types.
 *
 * Register with `Aspects.of(scope).add(new ConstructResourceTagger({ ... }))`
 * to tag matching {@link CfnResource} instances during synthesis.
 * {@link ConstructResourceTagger.apply} registers several taggers on one or more scopes.
 */
export class ConstructResourceTagger implements IAspect {
  /**
   * Registers each tagger on every scope, preserving tagger order.
   *
   * @param props - Scopes and the taggers to register on each of them.
   * @throws If `scopes` is empty.
   * @throws If `taggers` is empty.
   */
  public static apply(props: ApplyResourceTaggersProps): void {
    if (props.scopes.length === 0) {
      throw new Error('scopes must contain at least one scope.');
    }
    if (props.taggers.length === 0) {
      throw new Error('taggers must contain at least one tagger.');
    }

    for (const scope of props.scopes) {
      const aspects = Aspects.of(scope);
      for (const tagger of props.taggers) {
        aspects.add(tagger);
      }
    }
  }

  private readonly resourceTypes: ReadonlySet<string>;
  private readonly tags: Record<string, string> | ConstructResourceTagValues;
  private readonly pathMatcher?: IPathMatcher;
  private readonly overwrite: boolean;
  private readonly tagProps?: TagProps;

  /**
   * Creates a tagger aspect from the given configuration.
   *
   * @param props - Resource types, tags, and optional filtering / TagProps options.
   * @throws If `resourceTypes` is empty.
   * @throws If both `pathFilter` and `pathMatcher` are set.
   */
  constructor(props: ConstructResourceTaggerProps) {
    if (props.resourceTypes.length === 0) {
      throw new Error('resourceTypes must contain at least one resource type.');
    }
    if (props.pathFilter && props.pathMatcher !== undefined) {
      throw new Error('Specify only one of pathFilter or pathMatcher.');
    }
    this.resourceTypes = new Set(props.resourceTypes);
    this.tags = props.tags;
    let pathMatcher = props.pathMatcher;
    if (props.pathFilter) {
      pathMatcher = PathMatcher.prefix(props.pathFilter);
    }
    this.pathMatcher = pathMatcher;
    this.overwrite = props.overwrite ?? true;
    this.tagProps = props.tagProps;
  }

  /**
   * Applies configured tags when `node` is an L1 resource whose CloudFormation
   * type matches a configured resource type and optionally matches `pathFilter`
   * or `pathMatcher`. When `tags` is a function, it is called for that
   * resource. Respects `overwrite` and forwards `tagProps` to
   * {@link Tags.add}.
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

    const tags = resolveTags(this.tags, node);
    let existingTagKeys: ReadonlySet<string> | undefined;
    if (!this.overwrite) {
      const read = readExistingTagKeys(node);
      existingTagKeys = read.kind === 'readable' ? read.keys : new Set();
    }

    Object.entries(tags).forEach(([key, value]) => {
      if (existingTagKeys?.has(key)) {
        return;
      }
      Tags.of(node).add(key, value, this.tagProps);
    });
  }
}
