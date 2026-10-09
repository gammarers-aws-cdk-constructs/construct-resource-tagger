/**
 * Returns whether a prefix of `prefixLength` segments can start at `offset`.
 *
 * @param pathLength - Number of `/`-delimited segments in the construct path.
 * @param prefixLength - Number of segments in the prefix.
 * @param offset - Segment index where the prefix would start.
 * @returns True when the prefix fits inside the path at `offset`.
 */
export const canStartAt = (
  pathLength: number,
  prefixLength: number,
  offset: number,
): boolean => offset + prefixLength <= pathLength;

/**
 * Returns whether `prefixSegments` equals the path segments that begin at
 * `offset`.
 *
 * @param pathSegments - `/`-delimited construct path segments.
 * @param prefixSegments - Prefix segments to compare.
 * @param offset - Segment index where the comparison starts.
 * @returns True when every prefix segment matches.
 */
export const startsAt = (
  pathSegments: readonly string[],
  prefixSegments: readonly string[],
  offset: number,
): boolean =>
  prefixSegments.every(
    (segment, index) => pathSegments[offset + index] === segment,
  );

/**
 * Returns whether `prefix` appears as a contiguous sequence of `/`-delimited
 * segments in `path`. `"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`,
 * but not `Stack/NonProd`.
 *
 * @param path - Construct path (`IConstruct.node.path`).
 * @param prefix - Path segments to match (for example `Prod` or `App/Prod`).
 * @returns True when `prefix` matches at a segment boundary.
 */
export const matchesPathPrefix = (path: string, prefix: string): boolean => {
  const pathSegments = path.split('/');
  const prefixSegments = prefix.split('/');

  let offset = 0;
  while (canStartAt(pathSegments.length, prefixSegments.length, offset)) {
    if (startsAt(pathSegments, prefixSegments, offset)) {
      return true;
    }
    offset += 1;
  }
  return false;
};
