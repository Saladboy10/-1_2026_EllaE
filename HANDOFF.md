# Handoff: moving Level Up to another Claude account

This repo holds everything needed to keep building and publishing **Level Up** (the game lobby)
and **Dodge and Weave** (the 3D runner) from a different Claude account. Conversations can't move
between accounts, so this page is the summary of what was built and how to carry on.

## Where the code is
- Repository: `saladboy10/-1_2026_ellae`
- Branch: `claude/game-development-oysmds` (all the work is here; it has not been merged into the main branch)

## What's in the game
- **Lobby (`index.html`)**: game cards with a Play and a Leaderboard button (top 20), "Coming soon" slots,
  a "Request a skin" box (idea + optional photo), and an owner-only Inbox for requests.
- **Dodge and Weave (`games/rail-rush.js`, `games/rail-rush.css`)**: three-lane runner with jumping and rolling,
  coins, a crash-screen leaderboard, anime-style characters (toon shading, outlines, anime eyes and hair),
  an avatar maker (skin, hair, eyes, expression, mouth, clothes, hats, extras, name), skins, pets and emotes
  bought with coins (tap once to try, again to buy), and a Codes box in the top-left of the menu.
- **Pets**: Milo the pup (105), Tails the fox (105) and Ember, a baby dragon with flapping wings (130).
  Pets are built in `buildPet` in `games/rail-rush.js` (Ember has its own `buildDragon`) and listed in the `pet` row near the top of that file.
- **Web Swing (`games/web-swing.js`, `games/web-swing.css`)**: a 3D city where you swing on webs, climb walls and
  collect coins in 90 seconds as Spider Pig (the default, `buildSpiderPig`) or your Dodge and Weave runner. Coins go into the Dodge and Weave bank; it has its own leaderboard.
- **Jimmy Yum-Yum (`games/star-catcher.js`, `games/star-catcher.css`; it used to be called Star Catcher)**: a hungry boy with a huge mouth eats falling burgers and
  hot dogs and dodges broccoli and carrots. Food is also coins for the Dodge and Weave bank; it has its own leaderboard.
- **Glow Squares (`games/glow-squares.js`, `games/glow-squares.css`)**: a 3D party game against 11 computer players; stand on
  the glowing squares before the countdown ends or fall. Uses `buildAvatar` for everyone; its own leaderboard.
- **Tumble Dash (`games/tumble-dash.js`, `games/tumble-dash.css`)**: Stumble Guys-style party games against 11 computer
  runners. A wheel picks one of four games (`MODES` in the file): Obstacle Race, Block Dash, Tile Fall and Spin Zone.
  Each mode has `build`, `tick`, `hit`, `bot` and `camera`; add a new one there to put it on the wheel. Its own leaderboard.
- **Skin Shop**: the avatar maker (`#custom` in `games/rail-rush.js`, shown with Dodge and Weave's 3D view) opens from the lobby with `Lobby.shop()` / `RailRush.openShop()`, first thing on every visit and from the lobby's Skin Shop button. Dodge and Weave no longer has its own shop button. All games share one coin bank (`railrush.bank`), shown in the lobby.
- **Honeycomb**: its own lobby game, built on the Tumble Dash engine (`MODES.honey`, `window.Honeycomb`): five floors of honey hexagons that drop when stepped on. Its own leaderboard (`honeycomb`).
- **Monster Drive (`games/monster-drive.js`, `games/monster-drive.css`)**: a Drive Mad-style truck game with 8 levels (`LEVELS` at the top of the file: ground and bridge pieces as point lists). The truck is 4 points held by sticks (2D physics) drawn in 3D. Its leaderboard (`monsterdrive`) counts levels beaten.
- **Win celebration (`celebrate.js`)**: `Celebrate.win()` shows a giant rainbow "YOU WON!" with confetti; the games call it when you win.
- **Shared storage (`leaderboard.js`)**: leaderboards, secret codes limited to a number of players, and skin requests.
- **Secrets**: secret codes and the secret "unlock everything" runner name are stored scrambled (`codeHash`)
  in `games/rail-rush.js`. They are deliberately not written anywhere in plain text. The owner knows them.

## How to publish it from the new account
Open a Claude Code session on the web with this repository and branch, then ask Claude to:

1. Build the page: `python3 tools/build-artifact.py /tmp/level-up.html`
2. Publish that file as an artifact titled **Level Up**, with the `game` icon, these runtime capabilities:

```json
{
  "db": {
    "rules": [
      { "path": "railrush", "read": "view", "write": "owner" },
      { "path": "railrush/{self}", "write": "interact" },
      { "path": "webswing", "read": "view", "write": "owner" },
      { "path": "webswing/{self}", "write": "interact" },
      { "path": "starcatcher", "read": "view", "write": "owner" },
      { "path": "starcatcher/{self}", "write": "interact" },
      { "path": "glowsquares", "read": "view", "write": "owner" },
      { "path": "glowsquares/{self}", "write": "interact" },
      { "path": "tumbledash", "read": "view", "write": "owner" },
      { "path": "tumbledash/{self}", "write": "interact" },
      { "path": "honeycomb", "read": "view", "write": "owner" },
      { "path": "honeycomb/{self}", "write": "interact" },
      { "path": "monsterdrive", "read": "view", "write": "owner" },
      { "path": "monsterdrive/{self}", "write": "interact" },
      { "path": "claims", "read": "view", "write": "owner" },
      { "path": "claims/{self}", "write": "interact" },
      { "path": "codelocks", "read": "interact", "write": "interact" },
      { "path": "requests", "read": "owner", "write": "owner" },
      { "path": "requests/{self}", "read": "interact", "write": "interact" }
    ]
  },
  "user": {}
}
```

   and the supporting files `assets/rail-rush.jpg`, `assets/web-swing.jpg`, `assets/star-catcher.jpg`, `assets/glow-squares.jpg`, `assets/tumble-dash.jpg`, `assets/honeycomb.jpg` and `assets/monster-drive.jpg`, published at those same paths.

3. Share it from the artifact's Share menu. On a school (organization) account, choosing
   "Anyone in your organization" as **Contributor** lets every classmate save scores, use codes and send requests.

A new artifact starts with an empty leaderboard, no code claims and no requests; players' coins and
unlocks are saved per device and per link, so they also start fresh on the new link.

## Sharing with a friend
- **Code:** add them as a collaborator on GitHub (repo **Settings → Collaborators → Add people**).
- **The conversation:** chats can't be moved to another account, so this page is the summary. They can open
  Claude Code on the web with this repository and branch and say: "Read HANDOFF.md and keep building the game."

## Testing locally
Open `index.html` in a browser. Everything plays; the leaderboard, codes limit and requests stay hidden
or say they only work in the published game, because they need the artifact's shared storage.
