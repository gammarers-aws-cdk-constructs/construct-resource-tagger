import { IConstruct } from 'constructs';
import { matchesPathPrefix } from './path-matcher-predicates';

/**
 * Decides whether a construct is selected based on its location in the
 * construct tree.
 *
 * {@link ConstructResourceTagger} applies tags to a selected construct.
 * {@link ConstructResourceTagValidator} checks required tag keys on a selected construct.
 */
export interface IPathMatcher {
  /**
   * Returns whether the aspect should act on `node`.
   *
   * @param node - Construct visited during aspect traversal.
   * @returns Whether `node` is selected.
   */
  matches(node: IConstruct): boolean;
}

type PathMatcherKind = 'prefix' | 'pattern';

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

  /**
   * Stores a prefix or regular-expression matcher.
   *
   * @param kind - Prefix or regular-expression matching.
   * @param value - Prefix string or regular-expression source.
   */
  private constructor(kind: PathMatcherKind, value: string) {
    this.kind = kind;
    this.value = value;
  }

  /**
   * Returns whether the aspect should act on `node`.
   *
   * @param node - Construct visited during aspect traversal.
   * @returns Whether `node` is selected.
   */
  public matches(node: IConstruct): boolean {
    if (this.kind === 'prefix') {
      return matchesPathPrefix(node.node.path, this.value);
    }
    return new RegExp(this.value).test(node.node.path);
  }
}
