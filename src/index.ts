import { CfnResource, IAspect, TagManager, TagProps, Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/** Configuration for {@link ConstructResourceTagger}. */
export interface ConstructResourceTaggerProps {
  /**
   * CloudFormation type names of target L1 resources
   * (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`).
   * Must contain at least one entry.
   */
  readonly resourceTypes: string[];
  /** Key-value pairs applied to each matching resource. */
  readonly tags: Record<string, string>;
  /**
   * Optional construct path substring; when set, only nodes whose
   * {@link IConstruct.node | node.path} includes this value are tagged.
   */
  readonly pathFilter?: string;
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
 * Reads a tag key from a rendered tag entry in either CDK (`key`) or
 * CloudFormation (`Key`) property form.
 *
 * @param tag - A single entry from {@link TagManager.renderTags}.
 * @returns The tag key, or `undefined` when the entry is unrecognized.
 */
const getTagKey = (tag: unknown): string | undefined => {
  if (typeof tag !== 'object' || tag === null) {
    return undefined;
  }

  if ('key' in tag && typeof tag.key === 'string') {
    return tag.key;
  }

  if ('Key' in tag && typeof tag.Key === 'string') {
    return tag.Key;
  }

  return undefined;
};

/**
 * Collects tag keys already present on a construct via its {@link TagManager}.
 *
 * @param node - Construct that may expose a tag manager.
 * @returns Existing tag keys, or an empty set when tags cannot be determined.
 */
const getExistingTagKeys = (node: IConstruct): ReadonlySet<string> => {
  const tagManager = TagManager.of(node);
  if (!tagManager) {
    return new Set();
  }

  const rendered = tagManager.renderTags();
  if (!Array.isArray(rendered)) {
    return new Set();
  }

  const keys = new Set<string>();
  for (const tag of rendered) {
    const key = getTagKey(tag);
    if (key !== undefined) {
      keys.add(key);
    }
  }
  return keys;
};

/**
 * CDK aspect that applies tags to L1 resources matching configured
 * CloudFormation resource types.
 *
 * Register with `Aspects.of(scope).add(new ConstructResourceTagger({ ... }))`
 * to tag matching {@link CfnResource} instances during synthesis.
 */
export class ConstructResourceTagger implements IAspect {
  private readonly resourceTypes: ReadonlySet<string>;
  private readonly tags: Record<string, string>;
  private readonly pathFilter?: string;
  private readonly overwrite: boolean;
  private readonly tagProps?: TagProps;

  /**
   * Creates a tagger aspect from the given configuration.
   *
   * @param props - Resource types, tags, and optional filtering / TagProps options.
   * @throws If `resourceTypes` is empty.
   */
  constructor(props: ConstructResourceTaggerProps) {
    if (props.resourceTypes.length === 0) {
      throw new Error('resourceTypes must contain at least one resource type.');
    }
    this.resourceTypes = new Set(props.resourceTypes);
    this.tags = props.tags;
    this.pathFilter = props.pathFilter;
    this.overwrite = props.overwrite ?? true;
    this.tagProps = props.tagProps;
  }

  /**
   * Applies configured tags when `node` is an L1 resource whose CloudFormation
   * type matches a configured resource type and optionally matches `pathFilter`.
   * Respects `overwrite` and forwards `tagProps` to {@link Tags.add}.
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
    if (this.pathFilter && !node.node.path.includes(this.pathFilter)) {
      return;
    }

    const existingTagKeys = this.overwrite
      ? undefined
      : getExistingTagKeys(node);

    Object.entries(this.tags).forEach(([key, value]) => {
      if (existingTagKeys?.has(key)) {
        return;
      }
      Tags.of(node).add(key, value, this.tagProps);
    });
  }
}
