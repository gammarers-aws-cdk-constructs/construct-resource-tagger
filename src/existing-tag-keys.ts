import { TagManager } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * Tag keys read from a construct, or a signal that they could not be read.
 * Unreadable tags are not the same as a resource that has no tags.
 */
export type ExistingTagKeyRead =
  | {
    readonly kind: 'readable';
    readonly keys: ReadonlySet<string>;
  }
  | {
    readonly kind: 'unreadable';
  };

/**
 * Reads a tag key from a rendered tag entry in either CDK (`key`) or
 * CloudFormation (`Key`) property form.
 *
 * @param tag - A single entry from {@link TagManager.renderTags}.
 * @returns The tag key, or `undefined` when the entry is unrecognized.
 */
const tagKey = (tag: unknown): string | undefined => {
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
 * @returns The keys when tags can be read. No tags is an empty key set.
 * `kind: 'unreadable'` means the construct has no tag manager, or rendered
 * tags are not an array.
 */
export const readExistingTagKeys = (node: IConstruct): ExistingTagKeyRead => {
  const tagManager = TagManager.of(node);
  if (!tagManager) {
    return { kind: 'unreadable' };
  }

  const rendered = tagManager.renderTags();
  // TagManager.renderTags() returns undefined when the resource has no tags.
  if (rendered === undefined) {
    return { kind: 'readable', keys: new Set() };
  }
  if (!Array.isArray(rendered)) {
    return { kind: 'unreadable' };
  }

  const keys = new Set<string>();
  for (const tag of rendered) {
    const key = tagKey(tag);
    if (key !== undefined) {
      keys.add(key);
    }
  }
  return { kind: 'readable', keys };
};
