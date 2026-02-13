# Obsidian Embed Snippets (Milestone 7)

Use these snippets to embed the new React module route in Obsidian pages.

## Stable student route

```html
<iframe
  src="https://<host>/embed/module/pilot-vertragsrecht?view=student&origin=obsidian"
  style="border:0; width:100%; min-height:860px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

## Fallback link (recommended)

Always provide a direct fallback link under the iframe:

```markdown
[Fallback: Modul direkt oeffnen](https://<host>/embed/fallback?moduleId=pilot-vertragsrecht&reason=obsidian-embed)
```

## Notes

- Keep the route format stable: `/embed/module/:moduleId?view=student&origin=obsidian`.
- The `origin=obsidian` query marker is consumed by session analytics.
- If the embed cannot render, learners can continue via `/embed/fallback` and then open direct mode.
