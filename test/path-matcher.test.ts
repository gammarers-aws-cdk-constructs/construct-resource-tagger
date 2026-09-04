import { IConstruct } from 'constructs';
import { PathMatcher } from '../src';

const constructAt = (path: string): IConstruct =>
  ({ node: { path } }) as unknown as IConstruct;

describe('PathMatcher.prefix', () => {
  test.each([
    ['Prod', 'Prod', true],
    ['Prod', 'Prod/Bucket', true],
    ['Prod', 'Stack/Prod', true],
    ['Prod', 'Stack/Prod/Bucket', true],
    ['Prod', 'Stack/NonProd', false],
    ['Prod', 'Stack/NonProd/Bucket', false],
    ['Prod', 'Production', false],
    ['Prod', 'Stack/ProdExtra', false],
    ['Prod', 'Stack/ExtraProd', false],
    ['Foo/Bar', 'Foo/Bar', true],
    ['Foo/Bar', 'Stack/Foo/Bar/Baz', true],
    ['Foo/Bar', 'Stack/Foo/BarBaz', false],
    ['Foo/Bar', 'Stack/MyFoo/Bar', false],
  ])('prefix %s vs path %s → %s', (prefix, path, expected) => {
    expect(PathMatcher.prefix(prefix).matches(constructAt(path))).toBe(expected);
  });

  test('should throw when prefix is empty', () => {
    expect(() => PathMatcher.prefix('')).toThrow('prefix must be a non-empty string.');
  });
});

describe('PathMatcher.pattern', () => {
  test.each([
    ['(^|/)Prod(/|$)', 'Stack/Prod/Bucket', true],
    ['(^|/)Prod(/|$)', 'Stack/NonProd/Bucket', false],
    ['DataPlane$', 'App/DataPlane', true],
    ['DataPlane$', 'App/DataPlane/Bucket', false],
  ])('pattern %s vs path %s → %s', (pattern, path, expected) => {
    expect(PathMatcher.pattern(pattern).matches(constructAt(path))).toBe(expected);
  });

  test('should throw when pattern is empty', () => {
    expect(() => PathMatcher.pattern('')).toThrow('pattern must be a non-empty string.');
  });

  test('should throw when pattern is an invalid regular expression', () => {
    expect(() => PathMatcher.pattern('[')).toThrow();
  });
});
