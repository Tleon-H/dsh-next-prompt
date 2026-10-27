# dsh-next-prompt

[简体中文](README.md) | **English**

[![npm](https://img.shields.io/npm/v/dsh-next-prompt)](https://www.npmjs.com/package/dsh-next-prompt)
[![test](https://github.com/Tleon-H/dsh-next-prompt/actions/workflows/test.yml/badge.svg)](https://github.com/Tleon-H/dsh-next-prompt/actions/workflows/test.yml)

A DeepSeek Harness (DSH) desktop plugin that adds two small features to the input box:

- **→ / Tab: accept a suggested next prompt.** When the agent finishes replying, a light gray suggestion appears in the empty input box, guessing what you are likely to say next based on the recent conversation. Press `Tab` or `→` to put it into your draft.
- **↑ / ↓: browse what you sent.** With the input box empty, press `↑` to fill in the last message you sent in this session; keep pressing `↑` to go further back and `↓` to come forward again.

Both only fill the input box. **Nothing is ever sent automatically.**

> This plugin was called `dsh-prompt-prefill` before 0.5.0. If you installed the old one, run `dsh plugin --profile desktop remove dsh-prompt-prefill` first, then install as below.

Tested on DSH desktop **0.2.1-rc.3**, **0.2.1-rc.2** and **0.2.0-rc.2** (other versions are untested).

## Install

```powershell
dsh plugin --profile desktop add dsh-next-prompt
```

From DSH 0.2.1 on, no restart is needed: run the command while DSH is open and the plugin takes effect right away. On earlier versions, **fully quit DSH (including the tray icon) and reopen it** after installing; it is best to quit DSH before installing too, otherwise the command waits for DSH to release its file lock.

- Latest code from the repository: `dsh plugin --profile desktop add github:Tleon-H/dsh-next-prompt`
- Web version of DSH: replace `--profile desktop` with your own profile (usually `--profile web`)
- Update: `remove` and `add` again (DSH before 0.2.1 also needs a restart)
- Uninstall: `dsh plugin --profile desktop remove dsh-next-prompt`

## Usage

- When a reply finishes and the input box is empty, a gray suggestion appears within a few seconds. Press `Tab` / `→` to accept, `Escape` to dismiss; it hides as soon as you start typing.
- Just opening or browsing a session never calls the model. No suggestion is generated while the agent is replying, or when the last turn failed or was aborted.
- After you quit and reopen DSH, switching back to a session brings its last suggestion back, as long as nothing new was said since (no extra model call). Suggestions dismissed with `Escape` stay dismissed.
- When the conversation has no obvious next step, the model may return no suggestion, and nothing is shown.
- The plugin does not intercept keys with modifiers, during IME composition, or when the input box is not focused.

## Configuration

Open this plugin on DSH's Plugins page to edit the settings below; changes take effect immediately, with no reinstall or restart. You can also set them in [cordis.patch.yml](cordis.patch.yml). The most useful ones:

| Key | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Master switch |
| `provider` / `model` | `''` | Pin a model for generating suggestions; both must be set. Empty means follow the current session |
| `timeoutMs` | `20000` | Timeout per generation (ms) |
| `maxRecentTurns` | `3` | Number of recent messages sent to the model |
| `persistSuggestions` | `true` | Save each session's latest suggestion to `~/.dsh/plugin-data/dsh-next-prompt/suggestions.json` so it survives a restart; turn off to keep it in memory only |

See the comments in `cordis.patch.yml` for the rest.

The plugin reuses the models and API keys you already configured in DSH and needs no credentials of its own. If your chat model is slow or always reasons, or you use a plugin that switches models automatically, pin a fast non-reasoning model, for example:

```yaml
        provider: 'deepseek'
        model: 'deepseek-flash'
```

Only the text of the last few messages is sent to the model. Common key and token formats are masked first, but this pattern-based masking cannot catch every secret.

## Notes

- The gray text is an overlay aligned with the input box; very long suggestions may be cut off visually, but accepting still inserts the full text.
- Once you edit a recalled message, `↑` / `↓` move the cursor again; in a multi-line message the caret has to reach the start (`↑`) or end (`↓`) before it moves on. Pressing `↓` on the newest message clears the input box.
- Text only; image attachments are not restored.
- Do not install alongside other plugins that also intercept `Tab` / `→` / `↑` / `↓` (see [similar plugins](docs/similar-plugins.md)).

## More docs (Chinese)

- [Troubleshooting & diagnostics](docs/troubleshooting.md)
- [Developer notes](docs/development.md): how it works, pitfalls, tests
- [Changelog](CHANGELOG.md)

This is a small personal project. Feedback via [issues](https://github.com/Tleon-H/dsh-next-prompt/issues) is welcome, but replies are not guaranteed.

## License

MIT
