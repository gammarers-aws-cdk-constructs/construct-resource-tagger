import { TagManager } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

const unreadableTagsMessage = 'Tags cannot be read from the construct.';

/**
 * Base error for tag-key reading inside this package.
 * Not part of the published entry point.
 */
export abstract class ConstructResourceTaggerError extends Error {
  override readonly name: string = 'ConstructResourceTaggerError';

  protected constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ConstructResourceTaggerError.prototype);
  }
}

/**
 * Thrown when a construct has no tag manager, or its rendered tags are not an array.
 * A resource with no tags is not this error.
 */
export class ConstructResourceTaggerUnreadableTagsError extends ConstructResourceTaggerError {
  override readonly name: string = 'ConstructResourceTaggerUnreadableTagsError';

  constructor() {
    super(unreadableTagsMessage);
    Object.setPrototypeOf(this, ConstructResourceTaggerUnreadableTagsError.prototype);
  }
}

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
 * @returns Existing tag keys. An empty set means the resource has no tags.
 * @throws {@link ConstructResourceTaggerUnreadableTagsError} when tags cannot be read.
 */
export const readExistingTagKeys = (node: IConstruct): ReadonlySet<string> => {
  const tagManager = TagManager.of(node);
  if (!tagManager) {
    throw new ConstructResourceTaggerUnreadableTagsError();
  }

  const rendered = tagManager.renderTags();
  // TagManager.renderTags() returns undefined when the resource has no tags.
  if (rendered === undefined) {
    return new Set();
  }
  if (!Array.isArray(rendered)) {
    throw new ConstructResourceTaggerUnreadableTagsError();
  }

  const keys = new Set<string>();
  for (const tag of rendered) {
    const key = tagKey(tag);
    if (key !== undefined) {
      keys.add(key);
    }
  }
  return keys;
};
