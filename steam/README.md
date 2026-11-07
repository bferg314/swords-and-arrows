# Steam library art

`deploys/scripts/push-game` copies these into Steam on the game box as the game's library art.

| File | Size | Steam uses it for |
| --- | --- | --- |
| `portrait.png` | 600×900 (saved at 2x) | Library grid capsule |
| `wide.png` | 920×430 (saved at 2x) | Wide capsule, recent games |
| `hero.png` | 1920×620 (saved at 2x) | Banner on the game's page |
| `logo.png` | transparent | Title drawn over the banner |

`source/compose.html` builds all four from `source/scene.png`, a frame from the Celestial Citadel arena captured from the game itself at 2x zoom with combat text turned off. To rebuild, serve `source/` and screenshot `compose.html?m=portrait|wide|hero|logo` at the sizes above with a device scale factor of 2 (transparent background for the logo).
