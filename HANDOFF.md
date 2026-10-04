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
- **Sky Hop (`games/sky-hop.js`, `games/sky-hop.css`)**: an endless platform jumper with moving, breaking and spring
  platforms, coins that go into the Dodge and Weave bank, and its own leaderboard.
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
      { "path": "skyhop", "read": "view", "write": "owner" },
      { "path": "skyhop/{self}", "write": "interact" },
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

   and the supporting files `assets/rail-rush.jpg` and `assets/sky-hop.jpg`, published at those same paths.

3. Share it from the artifact's Share menu. On a school (organization) account, choosing
   "Anyone in your organization" as **Contributor** lets every classmate save scores, use codes and send requests.

A new artifact starts with an empty leaderboard, no code claims and no requests; players' coins and
unlocks are saved per device and per link, so they also start fresh on the new link.

## Testing locally
Open `index.html` in a browser. Everything plays; the leaderboard, codes limit and requests stay hidden
or say they only work in the published game, because they need the artifact's shared storage.
