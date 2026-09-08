# Assets

Brand assets distributed with the skill.

| File | What it is | Used by |
| --- | --- | --- |
| `logo.png` | The rootBoard mark: three fanned sticky notes over a root cluster. The real source file (cropped to content, otherwise unmodified). | The skill's large icon and the source repository README header. |
| `logo-toolbar.png` | The same mark, resized onto a small neutral card. | Base64-embedded directly into `renderer/whiteboard/whiteboard.js`'s toolbar chrome (kept in sync by hand — see the comment at its call site). |

`logo.png` has a soft shadow baked into it against a white page background,
which doesn't cut out to a clean transparent PNG (it leaves a pale halo on a
dark ground — this was tried and reverted). `logo-toolbar.png` sidesteps
that by giving the mark a small opaque card of its own rather than trying to
matte it, so it reads correctly on both light and dark toolbars. Regenerate
it from `logo.png` if the source image ever changes; it isn't a separate
asset to hand-edit. It was a WebP (`logo-toolbar.webp`) until this browser
environment turned out to reliably fail decoding that exact file once
embedded as a data: URI in the actual whiteboard page (not a corrupt-file
issue — it opened fine standalone and via other decoders); PNG is the
safer, more universally-supported pick for an inline data: URI.

Neither file has a text or font dependency of its own; the "rootBoard"
wordmark next to the mark is set separately in each consumer (plain heading
text in the source repository README and the system sans-serif stack in the
whiteboard — see `renderer/whiteboard/whiteboard.css`).
