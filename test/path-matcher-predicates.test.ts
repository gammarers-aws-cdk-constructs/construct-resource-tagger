import {
  canStartAt,
  matchesPathPrefix,
  startsAt,
} from '../src/path-matcher-predicates';

describe('canStartAt', () => {
  test.each([
    [3, 1, 0, true],
    [3, 1, 2, true],
    [3, 1, 3, false],
    [2, 2, 0, true],
    [2, 2, 1, false],
    [0, 1, 0, false],
    [1, 0, 0, true],
  ])(
    'pathLength %s prefixLength %s offset %s → %s',
    (pathLength, prefixLength, offset, expected) => {
      expect(canStartAt(pathLength, prefixLength, offset)).toBe(expected);
    },
  );
});

describe('startsAt', () => {
  test.each([
    [['Prod'], ['Prod'], 0, true],
    [['Stack', 'Prod', 'Bucket'], ['Prod'], 1, true],
    [['Stack', 'Prod', 'Bucket'], ['Prod', 'Bucket'], 1, true],
    [['Stack', 'NonProd'], ['Prod'], 1, false],
    [['Stack', 'Prod'], ['Prod', 'Bucket'], 1, false],
    [['Stack', 'ProdExtra'], ['Prod'], 1, false],
  ])('path %s prefix %s offset %s → %s', (pathSegments, prefixSegments, offset, expected) => {
    expect(startsAt(pathSegments, prefixSegments, offset)).toBe(expected);
  });
});

describe('matchesPathPrefix', () => {
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
    expect(matchesPathPrefix(path, prefix)).toBe(expected);
  });
});
