import { IConstruct } from 'constructs';

/**
 * Decides whether a construct should be tagged based on its location in the
 * construct tree.
 */
export interface IPathMatcher {
  /**
   * Returns whether `node` should receive tags.
   *
   * @param node - Construct visited during aspect traversal.
   * @returns Whether `node` should receive tags.
   */
  matches(node: IConstruct): boolean;
}

type PathMatcherKind = 'prefix' | 'pattern';

/**
 * Returns whether `prefix` appears as a contiguous sequence of `/`-delimited
 * segments in `path`. `"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`,
 * but not `Stack/NonProd`.
 *
 * @param path - Construct path (`IConstruct.node.path`).
 * @param prefix - Path segments to match (for example `Prod` or `App/Prod`).
 * @returns True when `prefix` matches at a segment boundary.
 */
const matchesPathPrefix = (path: string, prefix: string): boolean => {
  const pathSegments = path.split('/');
  const prefixSegments = prefix.split('/');

  const startsAt = (offset: number): boolean =>
    prefixSegments.every(
      (segment, index) => pathSegments[offset + index] === segment,
    );

  const canStartAt = (offset: number): boolean =>
    offset + prefixSegments.length <= pathSegments.length;

  let offset = 0;
  while (canStartAt(offset)) {
    if (startsAt(offset)) {
      return true;
    }
    offset += 1;
  }
  return false;
};

/**
 * Built-in {@link IPathMatcher} implementations for construct path matching.
 */
export class PathMatcher implements IPathMatcher {
  /**
   * Match when `prefix` appears as a contiguous sequence of construct path
   * segments. `"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`, but not
   * `Stack/NonProd`.
   *
   * @param prefix - Path segments to match (for example `Prod` or `App/Prod`).
   * @throws If `prefix` is empty.
   */
  public static prefix(prefix: string): PathMatcher {
    if (prefix.length === 0) {
      throw new Error('prefix must be a non-empty string.');
    }
    return new PathMatcher('prefix', prefix);
  }

  /**
   * Match when the construct path matches a JavaScript regular expression.
   *
   * @param pattern - Regular expression source tested against `node.path`.
   * @throws If `pattern` is empty or is not a valid regular expression.
   */
  public static pattern(pattern: string): PathMatcher {
    if (pattern.length === 0) {
      throw new Error('pattern must be a non-empty string.');
    }
    // Validate eagerly so callers fail at construction time, not during visit.
    new RegExp(pattern);
    return new PathMatcher('pattern', pattern);
  }

  private readonly kind: PathMatcherKind;
  private readonly value: string;

  private constructor(kind: PathMatcherKind, value: string) {
    this.kind = kind;
    this.value = value;
  }

  /**
   * Returns whether `node` should receive tags.
   *
   * @param node - Construct visited during aspect traversal.
   * @returns Whether `node` should receive tags.
   */
  public matches(node: IConstruct): boolean {
    if (this.kind === 'prefix') {
      return matchesPathPrefix(node.node.path, this.value);
    }
    return new RegExp(this.value).test(node.node.path);
  }
}
