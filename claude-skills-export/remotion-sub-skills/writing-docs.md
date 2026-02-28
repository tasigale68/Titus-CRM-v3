# Remotion: Writing Docs

## Description
Guides for writing and editing Remotion documentation. Covers MDX formatting, code snippets, special components, language guidelines, and documentation best practices.

## Trigger
When adding docs pages, editing MDX files in packages/docs, or writing documentation content for Remotion.

## Instructions

# Writing Remotion Documentation

Documentation lives in `packages/docs/docs` as `.mdx` files.

## Adding a new page

1. Create a new `.mdx` file in `packages/docs/docs`
2. Add the document to `packages/docs/sidebars.ts`
3. Write the content following guidelines below
4. Run `bun render-cards.ts` in `packages/docs` to generate social preview cards

**Breadcrumb (`crumb`)**: If a documentation page belongs to a package, add `crumb: '@remotion/package-name'` to the frontmatter.

**One API per page**: Each function or API should have its own dedicated documentation page.

**Public API only**: Documentation is for public APIs only. Do not mention internal/private APIs.

**Use headings for all fields**: Each property should be its own heading. Use `###` for top-level and `####` for nested properties.

## Language guidelines

- **Keep it brief**: Extra words cause information loss.
- **Link to terminology**: Use terminology page for Remotion-specific terms.
- **Avoid emotions**: Remove filler like "Great! Let's move on..."
- **Separate into paragraphs**: Break up long sections.
- **Address as "you"**: Not "we".
- **Don't blame the user**: Say "The input is invalid" not "You provided wrong input".
- **Don't assume it's easy**: Avoid "simply" and "just".

## Code snippets

Use `twoslash` to check snippets against TypeScript (preferred):

````md
```ts twoslash
import {useCurrentFrame} from 'remotion';
const frame = useCurrentFrame();
```
````

Use `// ---cut---` to hide setup code. Always add a `title` to code fences that show example usage.

## Special components

### Steps
```md
- <Step>1</Step> First step
- <Step>2</Step> Second step
```

### AvailableFrom
Use to indicate when a feature was added. For page-level, use with `# h1`:
```md
# &lt;MyComponent&gt;<AvailableFrom v="4.0.123" />
```

### CompatibilityTable
Indicate which runtimes and environments a component supports. Place in `## Compatibility` section.

### Optional parameters
Add `?` to the heading. Do NOT add `_optional_` text. Include default value in description.

```md
### onError?
Called when an error occurs. Default: errors are thrown.
```

### Combining optional and AvailableFrom
```md
### onError?<AvailableFrom v="4.0.50" />
```

## Generating preview cards

```bash
cd packages/docs && bun render-cards.ts
```

## Verifying docs compile

```bash
bun run build-docs
```
