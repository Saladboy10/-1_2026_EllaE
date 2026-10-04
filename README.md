# Games

Open `index.html` in a web browser for the **Level Up** game lobby, then pick a game. No install needed.

## Skin requests
Players press **Request a skin** in the top corner of the lobby to send an idea, with an optional photo. The owner sees them under **Inbox** (only the owner gets that button).

## Putting it online with Vercel
Vercel can host the game for free at an address like `levelup-edge.vercel.app`. No build step is needed:
it's a plain website. On Vercel the games play fully, but the leaderboard, the secret-code player limit and
skin requests don't work (they need the Claude version's shared storage); codes still work once per player.

1. Sign up at vercel.com with a parent or teacher, using **Continue with GitHub** (the account that owns this repo).
2. Choose **Add New → Project**, pick this repository and press **Import**.
3. Leave the settings as they are (Framework: **Other**, no build command) and press **Deploy**.
4. The work is on the branch `claude/game-development-oysmds`. Either merge it into `main` first, or in the
   project's **Settings → Environments → Production**, set the production branch to `claude/game-development-oysmds`.
5. To choose the address, open **Settings → Domains** and edit the `.vercel.app` name (for example `levelup-edge`).

## How it's organized
- `index.html` is the lobby. Every game lives inside this one page; the lobby covers the screen until you press Play.
- `games/` holds each game's own code (`rail-rush.js`/`rail-rush.css` for Dodge and Weave, `sky-hop.js`/`sky-hop.css` for Sky Hop).
- `leaderboard.js` runs the shared storage: leaderboards, limited secret codes and skin requests. Each game has its own board with every player's best score.
  Boards work in the published game; opened as a plain file, the games still play but the board stays hidden.
- `assets/` holds the pictures on the lobby cards.

## Adding a new game
1. Put its code in `games/` and load it from `index.html`. Give it `open()` and `close()` like `window.RailRush`, and a button that calls `Lobby.show()`.
2. Swap one of the "Coming soon" slots for a game card with a `data-game` Play button and a picture in `assets/`.
3. For a leaderboard, call `Leaderboard.submit('<game>', { name, score })` when a game ends and `Leaderboard.watch('<game>', 10, rows => ...)` to show it.

## Dodge and Weave
A 3D endless runner. Dodge trains and barriers across three tracks, grab coins, and see how far you get.

- **Move:** ← → (or A / D), or swipe left/right
- **Jump:** ↑ (or W / Space), or swipe up. Jump over red-and-white barriers.
- **Roll:** ↓ (or S), or swipe down. Roll under yellow-and-black barriers.
- **Pause:** P or Esc
- **Secret codes:** press **Codes** in the top-left corner of the main menu and type a code to get a prize. Each code works once per player and only for the first 3 players in total. The codes themselves are kept secret (they are stored scrambled in `games/rail-rush.js`).
- **Leaderboard:** when a run ends, your best score is saved under your runner's name. The top 5 show on the crash screen. Press **Leaderboard** on the game's card in the lobby to see the top 20 (place, name, score).

**Customize avatar** lets you type your runner's name (it floats above them and shows on the score screen) and pick a ready-made outfit or build your own look:

- **Outfits** (bought with coins): Alina 50 (dances on the menu), Quills 50, Big Bertha 100, Marge Simpson 100, Red Renaldo 100, Luffy 100, Zoro 100, Deku 100, Denki 100, Uraraka 100, All Might 100, Shoto 100, Aizawa 100, Messi 50. Your own name stays the same whatever you wear.
- **Emotes:** Wave, Dance and Floss are free; Spin 50, Jump for Joy 75, Dab 100, and The Duggee, Moonwalk, The Worm, Ransom and I Want It That Way 50 each. Play them from the menu, the avatar maker, or number keys. Tap anything locked once to try it on (or watch the emote) before buying; tap it again to buy.
- **My own:** skin, hair, eye color, expression (Normal, Happy, Angry, Sad, Surprised, Wink, Cool), mouth (Smile, Big grin, Gritted teeth, Smirk, Shout, Surprised, Frown, Tongue out, Straight), clothes, hats and extras. Outfits with a visible face also let you pick the expression and mouth. Coins you collect are saved and can unlock the Crown (150) and the Cape (100).
- **Pets** that run beside you (bought with coins): Milo 50, Tails 50, Ember the dragon 75

## Sky Hop
Bounce up an endless tower of platforms. You play as your Dodge and Weave runner, in its colors.

- **Steer:** ← → (or A / D), or press and hold the left or right side of the screen
- **Green** platforms are solid, **blue** ones slide side to side, **cracked brown** ones break, and **yellow springs** launch you high.
- Your score is how high you climb (in meters). It has its own leaderboard in the lobby.
- Coins you grab go into the same coin bank as Dodge and Weave, so you can spend them on skins, pets and emotes.

