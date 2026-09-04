# API Reference <a name="API Reference" id="api-reference"></a>


## Structs <a name="Structs" id="Structs"></a>

### ConstructResourceTaggerProps <a name="ConstructResourceTaggerProps" id="construct-resource-tagger.ConstructResourceTaggerProps"></a>

Configuration for {@link ConstructResourceTagger}.

#### Initializer <a name="Initializer" id="construct-resource-tagger.ConstructResourceTaggerProps.Initializer"></a>

```typescript
import { ConstructResourceTaggerProps } from 'construct-resource-tagger'

const constructResourceTaggerProps: ConstructResourceTaggerProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.resourceTypes">resourceTypes</a></code> | <code>string[]</code> | CloudFormation type names of target L1 resources (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`). Must contain at least one entry. |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.tags">tags</a></code> | <code>{[ key: string ]: string}</code> | Key-value pairs applied to each matching resource. |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.overwrite">overwrite</a></code> | <code>boolean</code> | When `false`, tag keys that already exist on a resource are left unchanged and only missing keys are added. |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.pathFilter">pathFilter</a></code> | <code>string</code> | Optional construct path prefix matched at `/`-delimited segment boundaries. `"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`, but not `Stack/NonProd`. |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.pathMatcher">pathMatcher</a></code> | <code><a href="#construct-resource-tagger.IPathMatcher">IPathMatcher</a></code> | Optional matcher that decides whether a construct should be tagged. |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.tagProps">tagProps</a></code> | <code>aws-cdk-lib.TagProps</code> | Options forwarded to {@link Tags.add} for each applied tag, such as `priority` and `applyToLaunchedInstances`. |

---

##### `resourceTypes`<sup>Required</sup> <a name="resourceTypes" id="construct-resource-tagger.ConstructResourceTaggerProps.property.resourceTypes"></a>

```typescript
public readonly resourceTypes: string[];
```

- *Type:* string[]

CloudFormation type names of target L1 resources (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`). Must contain at least one entry.

---

##### `tags`<sup>Required</sup> <a name="tags" id="construct-resource-tagger.ConstructResourceTaggerProps.property.tags"></a>

```typescript
public readonly tags: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}

Key-value pairs applied to each matching resource.

---

##### `overwrite`<sup>Optional</sup> <a name="overwrite" id="construct-resource-tagger.ConstructResourceTaggerProps.property.overwrite"></a>

```typescript
public readonly overwrite: boolean;
```

- *Type:* boolean
- *Default:* true

When `false`, tag keys that already exist on a resource are left unchanged and only missing keys are added.

---

##### `pathFilter`<sup>Optional</sup> <a name="pathFilter" id="construct-resource-tagger.ConstructResourceTaggerProps.property.pathFilter"></a>

```typescript
public readonly pathFilter: string;
```

- *Type:* string

Optional construct path prefix matched at `/`-delimited segment boundaries. `"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`, but not `Stack/NonProd`.

Cannot be combined with {@link pathMatcher}.

> [PathMatcher.prefix](PathMatcher.prefix)

---

##### `pathMatcher`<sup>Optional</sup> <a name="pathMatcher" id="construct-resource-tagger.ConstructResourceTaggerProps.property.pathMatcher"></a>

```typescript
public readonly pathMatcher: IPathMatcher;
```

- *Type:* <a href="#construct-resource-tagger.IPathMatcher">IPathMatcher</a>

Optional matcher that decides whether a construct should be tagged.

Use {@link PathMatcher.pattern} for regular expressions, or implement
{@link IPathMatcher} for a custom predicate.

Cannot be combined with {@link pathFilter}.

---

##### `tagProps`<sup>Optional</sup> <a name="tagProps" id="construct-resource-tagger.ConstructResourceTaggerProps.property.tagProps"></a>

```typescript
public readonly tagProps: TagProps;
```

- *Type:* aws-cdk-lib.TagProps

Options forwarded to {@link Tags.add} for each applied tag, such as `priority` and `applyToLaunchedInstances`.

> [TagProps](TagProps)

---

## Classes <a name="Classes" id="Classes"></a>

### ConstructResourceTagger <a name="ConstructResourceTagger" id="construct-resource-tagger.ConstructResourceTagger"></a>

- *Implements:* aws-cdk-lib.IAspect

CDK aspect that applies tags to L1 resources matching configured CloudFormation resource types.

Register with `Aspects.of(scope).add(new ConstructResourceTagger({ ... }))`
to tag matching {@link CfnResource} instances during synthesis.

#### Initializers <a name="Initializers" id="construct-resource-tagger.ConstructResourceTagger.Initializer"></a>

```typescript
import { ConstructResourceTagger } from 'construct-resource-tagger'

new ConstructResourceTagger(props: ConstructResourceTaggerProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#construct-resource-tagger.ConstructResourceTagger.Initializer.parameter.props">props</a></code> | <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps">ConstructResourceTaggerProps</a></code> | - Resource types, tags, and optional filtering / TagProps options. |

---

##### `props`<sup>Required</sup> <a name="props" id="construct-resource-tagger.ConstructResourceTagger.Initializer.parameter.props"></a>

- *Type:* <a href="#construct-resource-tagger.ConstructResourceTaggerProps">ConstructResourceTaggerProps</a>

Resource types, tags, and optional filtering / TagProps options.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#construct-resource-tagger.ConstructResourceTagger.visit">visit</a></code> | Applies configured tags when `node` is an L1 resource whose CloudFormation type matches a configured resource type and optionally matches `pathFilter` or `pathMatcher`. |

---

##### `visit` <a name="visit" id="construct-resource-tagger.ConstructResourceTagger.visit"></a>

```typescript
public visit(node: IConstruct): void
```

Applies configured tags when `node` is an L1 resource whose CloudFormation type matches a configured resource type and optionally matches `pathFilter` or `pathMatcher`.

Respects `overwrite` and forwards `tagProps` to
{@link Tags.add}.

###### `node`<sup>Required</sup> <a name="node" id="construct-resource-tagger.ConstructResourceTagger.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

Construct visited during aspect traversal.

---




### PathMatcher <a name="PathMatcher" id="construct-resource-tagger.PathMatcher"></a>

- *Implements:* <a href="#construct-resource-tagger.IPathMatcher">IPathMatcher</a>

Built-in {@link IPathMatcher} implementations for construct path matching.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#construct-resource-tagger.PathMatcher.matches">matches</a></code> | Returns whether `node` should receive tags. |

---

##### `matches` <a name="matches" id="construct-resource-tagger.PathMatcher.matches"></a>

```typescript
public matches(node: IConstruct): boolean
```

Returns whether `node` should receive tags.

###### `node`<sup>Required</sup> <a name="node" id="construct-resource-tagger.PathMatcher.matches.parameter.node"></a>

- *Type:* constructs.IConstruct

Construct visited during aspect traversal.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#construct-resource-tagger.PathMatcher.pattern">pattern</a></code> | Match when the construct path matches a JavaScript regular expression. |
| <code><a href="#construct-resource-tagger.PathMatcher.prefix">prefix</a></code> | Match when `prefix` appears as a contiguous sequence of construct path segments. |

---

##### `pattern` <a name="pattern" id="construct-resource-tagger.PathMatcher.pattern"></a>

```typescript
import { PathMatcher } from 'construct-resource-tagger'

PathMatcher.pattern(pattern: string)
```

Match when the construct path matches a JavaScript regular expression.

###### `pattern`<sup>Required</sup> <a name="pattern" id="construct-resource-tagger.PathMatcher.pattern.parameter.pattern"></a>

- *Type:* string

Regular expression source tested against `node.path`.

---

##### `prefix` <a name="prefix" id="construct-resource-tagger.PathMatcher.prefix"></a>

```typescript
import { PathMatcher } from 'construct-resource-tagger'

PathMatcher.prefix(prefix: string)
```

Match when `prefix` appears as a contiguous sequence of construct path segments.

`"Prod"` matches `Stack/Prod` and `Stack/Prod/Bucket`, but not
`Stack/NonProd`.

###### `prefix`<sup>Required</sup> <a name="prefix" id="construct-resource-tagger.PathMatcher.prefix.parameter.prefix"></a>

- *Type:* string

Path segments to match (for example `Prod` or `App/Prod`).

---



## Protocols <a name="Protocols" id="Protocols"></a>

### IPathMatcher <a name="IPathMatcher" id="construct-resource-tagger.IPathMatcher"></a>

- *Implemented By:* <a href="#construct-resource-tagger.PathMatcher">PathMatcher</a>, <a href="#construct-resource-tagger.IPathMatcher">IPathMatcher</a>

Decides whether a construct should be tagged based on its location in the construct tree.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#construct-resource-tagger.IPathMatcher.matches">matches</a></code> | Returns whether `node` should receive tags. |

---

##### `matches` <a name="matches" id="construct-resource-tagger.IPathMatcher.matches"></a>

```typescript
public matches(node: IConstruct): boolean
```

Returns whether `node` should receive tags.

###### `node`<sup>Required</sup> <a name="node" id="construct-resource-tagger.IPathMatcher.matches.parameter.node"></a>

- *Type:* constructs.IConstruct

Construct visited during aspect traversal.

---


