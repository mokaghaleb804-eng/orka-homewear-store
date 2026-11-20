# ORKA browser icon acceptance checks

- [x] Original ORKA logo referenced without redrawing letters or children.
- [x] Favicon SVG is self-contained and uses a square canvas.
- [x] HTML head declares SVG favicon, PNG fallback, Apple touch icon and manifest.
- [x] Manifest contains brand name, theme and icon references.
- [x] Vercel check succeeded on commit 0b7043cf3d50ba5528396ab141e5e45cdc5e675d.
- [ ] Upload the prepared 48/180/192/512 PNG and favicon.ico binaries to this branch, then reference them in HTML and manifest. The current GitHub text-file connector does not upload binary artifacts.
- [ ] Confirm image endpoints return HTTP 200 and proper MIME types on preview.
- [ ] Verify appearance in Android Chrome shortcut and Add to Home screen, iOS Safari, desktop tabs, and after cache refresh.
- [ ] Confirm PR checks on the final commit and request approval before merge/deploy.

No production changes or merge are authorized by this checklist.
