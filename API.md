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
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.resourceType">resourceType</a></code> | <code>string</code> | CloudFormation type name of target L1 resources (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`). |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.tags">tags</a></code> | <code>{[ key: string ]: string}</code> | Key-value pairs applied to each matching resource. |
| <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps.property.pathFilter">pathFilter</a></code> | <code>string</code> | Optional construct path substring; |

---

##### `resourceType`<sup>Required</sup> <a name="resourceType" id="construct-resource-tagger.ConstructResourceTaggerProps.property.resourceType"></a>

```typescript
public readonly resourceType: string;
```

- *Type:* string

CloudFormation type name of target L1 resources (for example, `CfnBucket.CFN_RESOURCE_TYPE_NAME`).

---

##### `tags`<sup>Required</sup> <a name="tags" id="construct-resource-tagger.ConstructResourceTaggerProps.property.tags"></a>

```typescript
public readonly tags: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}

Key-value pairs applied to each matching resource.

---

##### `pathFilter`<sup>Optional</sup> <a name="pathFilter" id="construct-resource-tagger.ConstructResourceTaggerProps.property.pathFilter"></a>

```typescript
public readonly pathFilter: string;
```

- *Type:* string

Optional construct path substring;

when set, only nodes whose
{@link IConstruct.nodenode.path} includes this value are tagged.

---

## Classes <a name="Classes" id="Classes"></a>

### ConstructResourceTagger <a name="ConstructResourceTagger" id="construct-resource-tagger.ConstructResourceTagger"></a>

- *Implements:* aws-cdk-lib.IAspect

CDK aspect that applies tags to L1 resources of a given type.

Register with `Aspects.of(scope).add(new ConstructResourceTagger({ ... }))`
to tag matching {@link CfnResource} instances during synthesis.

#### Initializers <a name="Initializers" id="construct-resource-tagger.ConstructResourceTagger.Initializer"></a>

```typescript
import { ConstructResourceTagger } from 'construct-resource-tagger'

new ConstructResourceTagger(props: ConstructResourceTaggerProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#construct-resource-tagger.ConstructResourceTagger.Initializer.parameter.props">props</a></code> | <code><a href="#construct-resource-tagger.ConstructResourceTaggerProps">ConstructResourceTaggerProps</a></code> | - Resource type, tags, and optional path filter. |

---

##### `props`<sup>Required</sup> <a name="props" id="construct-resource-tagger.ConstructResourceTagger.Initializer.parameter.props"></a>

- *Type:* <a href="#construct-resource-tagger.ConstructResourceTaggerProps">ConstructResourceTaggerProps</a>

Resource type, tags, and optional path filter.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#construct-resource-tagger.ConstructResourceTagger.visit">visit</a></code> | Applies configured tags when `node` is an L1 resource whose CloudFormation type matches `resourceType` and optionally matches `pathFilter`. |

---

##### `visit` <a name="visit" id="construct-resource-tagger.ConstructResourceTagger.visit"></a>

```typescript
public visit(node: IConstruct): void
```

Applies configured tags when `node` is an L1 resource whose CloudFormation type matches `resourceType` and optionally matches `pathFilter`.

###### `node`<sup>Required</sup> <a name="node" id="construct-resource-tagger.ConstructResourceTagger.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

Construct visited during aspect traversal.

---





