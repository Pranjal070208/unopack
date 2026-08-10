# Chaos Cards

Build a Real-Time Multiplayer ONO No Mercy Web Game

Build a polished, production-quality real-time multiplayer web game inspired by the fast, chaotic card-game experience of “ONO No Mercy.” The goal is to let friends create a private room, invite each other with a room code/link, and play together in real time from their phones or desktops.

The experience should feel like a premium modern party game with dramatic animations, satisfying interactions, playful chaos, sound effects, player reactions, and a highly gamified interface.

Do NOT make this look like a normal SaaS dashboard or a basic CRUD application.

The website should feel like an actual online multiplayer game.

1. CORE PRODUCT EXPERIENCE

The primary user journey should be:

User lands on the homepage.

They see a bold, animated game landing screen.

User can:

Create Game

Join Game

How to Play

Creating a game generates a unique room code.

The host can share the room link/code with friends.

Players join the lobby using the code.

Each player enters a nickname and chooses an avatar.

The lobby displays all connected players in real time.

Host starts the game when enough players have joined.

The game begins with an animated countdown.

Players receive their cards.

The active player is clearly highlighted.

Every player's game state updates in real time.

Cards can be played interactively.

Invalid cards should be visually disabled.

Draw-card interactions should be animated.

Special cards should trigger dramatic animations.

Player turns should automatically synchronize between all clients.

Players can send quick reactions/emotes.

The game ends with a dramatic winner animation.

Display final rankings and statistics.

Provide:

Play Again

Return to Lobby

Share Room

2. IMPORTANT: REAL-TIME MULTIPLAYER

Use a proper real-time backend.

Prefer:

Supabase

Supabase Realtime

Supabase Auth where appropriate

PostgreSQL for persistent room/game data

Do NOT fake multiplayer using localStorage.

All players connected to the same room must see state changes in real time.

Synchronize:

Player joins

Player leaves

Player reconnects

Player nickname

Player avatar

Player ready status

Host status

Game start

Turn changes

Card draws

Card plays

Special card effects

Card count

Current discard card

Current player

Direction

Pending draw penalties

Winner

Game-over state

Reactions/emotes

The server/backend should be authoritative wherever possible so players cannot easily manipulate their own hand or turn state from the browser.

3. ROOM SYSTEM

Create a room-based multiplayer architecture.

Each room should have:

Unique room ID

Short human-friendly room code

Host player

Player list

Maximum player count

Current game status

Current game state

Creation timestamp

Example room code:

X7K9P

The room URL should be shareable, for example:

/room/X7K9P

When a player opens the link, they should immediately see the join screen.

Allow the host to:

Start game

Kick players

Copy invite link

Copy room code

Show a small toast:

INVITE LINK COPIED!

with a satisfying animation.

4. LOBBY DESIGN

Create a visually exciting multiplayer lobby.

Header:

ONO No Mercy logo/title

Room code

Copy button

Leave button

Center:

Large title:

READY TO CAUSE CHAOS?

Below it:

Room: X7K9P

Player cards should appear around the screen.

Each player card contains:

Avatar

Nickname

Ready indicator

Host crown for host

Connection indicator

When somebody joins:

Player card should fly/slide into position.

Small particle burst.

Optional sound effect.

Text notification:

ARJUN JOINED THE CHAOS

When somebody leaves:

RAHUL ESCAPED THE CHAOS

Use smooth Framer Motion animations.

Host sees a large:

START GAME

button.

The button should have:

Pulsing glow

Hover scale

Press animation

Particle effect on click

5. VISUAL DESIGN LANGUAGE

The visual identity should feel inspired by an energetic card-game universe.

Use:

Deep black / very dark background

Rich red

Electric yellow

White

Dark charcoal

Occasional neon accents

The overall visual language should combine:

arcade game + party game + modern mobile game + premium UI

Avoid:

Corporate SaaS styling

Generic gradients everywhere

Excessively rounded generic cards

Boring white dashboards

Spreadsheet-like layouts

Use strong typography.

Typography should feel:

Bold

Playful

Competitive

Slightly rebellious

Highly readable

Use oversized headings and compact game labels.

6. HOMEPAGE

Create a cinematic landing page.

Hero section:

Large animated title:

ONO
NO MERCY

Subtitle:

THE CARD GAME WHERE FRIENDSHIPS GO TO DIE.

Primary CTA:

CREATE GAME

Secondary CTA:

JOIN GAME

Third CTA:

HOW TO PLAY

Background should have animated floating playing cards.

Cards should slowly rotate, move, and float around the hero.

Add subtle:

particles

glow

card shadows

motion blur

depth

parallax

The hero should immediately communicate:

THIS IS A GAME.

Not a website.

7. GAME TABLE

This is the most important screen.

Create a responsive virtual tabletop.

Desktop:

Opponents around the table

Central discard pile

Draw pile

Current player indicator

Direction indicator

Player hand at bottom

Game information at top

Mobile:

Opponents represented compactly across the top

Central card area

Player hand horizontally scrollable at bottom

Large touch-friendly controls

Avoid tiny UI elements

The game table should feel like a physical card table brought into a modern digital game.

8. PLAYER POSITIONS

For desktop, arrange opponents around the table.

Example:

             PLAYER 2

    PLAYER 3          PLAYER 4


          DISCARD
            DECK


             YOU


The active player should have a glowing animated border.

Show:

Avatar

Name

Number of cards

Turn indicator

Example:

RAHUL • 5 CARDS

If it is their turn:

YOUR TURN

or

RAHUL'S TURN

Animate the indicator with a pulse.

9. PLAYER HAND

The player's cards should sit along the bottom of the screen.

Cards should overlap slightly like a real hand.

When hovering:

Card rises

Card rotates slightly

Shadow increases

Glow appears

When selected:

Card moves upward

Scale increases slightly

Bright outline appears

When played:

Card should animate from the player's hand

Fly toward the discard pile

Rotate in 3D

Land with a satisfying bounce

Use Framer Motion.

Cards should be large enough for comfortable mobile touch interaction.

10. CARD DESIGN

Create beautiful digital cards.

Each card should have:

Strong color

Large number/symbol

High contrast

Rounded/organic card silhouette

Subtle texture

Gloss/reflection

Drop shadow

Add subtle card movement.

Cards should not look completely flat.

Use:

CSS transforms

perspective

shadows

gradients

highlights

subtle noise texture

Do not overdo the effects.

The cards must remain extremely readable.

11. CARD PLAY ANIMATIONS

Every card play should feel satisfying.

Normal card:

Card lifts from player's hand.

Card rotates toward table.

Card flies toward discard pile.

Card lands with slight bounce.

Small impact particle effect.

Discard pile briefly glows.

Special card:

Make the animation much more dramatic.

For example:

Screen shake

Card zoom

Particle burst

Flash

Direction arrow animation

Sound effect

Floating text

Example:

DRAW 4!

The text should slam onto the screen and disappear.

12. SPECIAL CARD EVENTS

Create unique animations for special cards.

Examples:

DRAW EFFECT

Large animated text:

DRAW!

Cards should visibly fly into the affected player's hand.

REVERSE

Animate the table direction indicator spinning.

Show:

REVERSE!

SKIP

Show:

SKIPPED!

with a quick screen flash.

WILD

Show a dramatic color-selection UI.

MERCY / CHAOS EFFECT

For particularly powerful cards, briefly intensify the visual effects:

Screen shake

Particles

Glow

Large typography

Card rotation

Sound

Keep the effects short so gameplay remains fast.

13. DRAW PILE

The draw pile should look like a real deck.

Stack multiple cards visually.

When the player draws:

Top card lifts

Flips

Moves into hand

Hand rearranges smoothly

If multiple cards are drawn:

Animate them sequentially.

Do not instantly change the card count without visual feedback.

14. TURN SYSTEM

Clearly communicate whose turn it is.

At the beginning of a player's turn:

Display:

YOUR TURN

with a quick animated entrance.

For opponents:

RAHUL'S TURN

Use an animated turn ring around the active player.

Add a subtle countdown timer if appropriate.

Example:

YOUR TURN · 12s

If a player doesn't act within the allowed time:

Show countdown warning

Pulse the timer

Automatically handle timeout according to the game rules

15. GAME RULES

Implement the actual ONO No Mercy rules rather than merely creating a visual prototype.

Create a centralized game-engine module responsible for:

Deck generation

Shuffle

Dealing

Valid card detection

Turn order

Direction

Draw penalties

Special cards

Wild cards

Win condition

Player elimination if applicable

Card stacking rules where applicable

Do not duplicate game logic inside React components.

Keep game logic separate from UI.

Example structure:

gameEngine.ts

Functions could include:

createDeck()

shuffleDeck()

dealCards()

isValidMove()

playCard()

drawCard()

calculateNextPlayer()

applyCardEffect()

checkWinner()

Make the rules easy to modify later.

16. REAL-TIME STATE ARCHITECTURE

Use a clear game-state model.

Example conceptual state:

Game
 ├── roomId
 ├── status
 ├── players[]
 ├── deck
 ├── discardPile
 ├── currentPlayerId
 ├── direction
 ├── pendingDraw
 ├── selectedColor
 ├── turnStartedAt
 └── winner


Each player:

Player
 ├── id
 ├── nickname
 ├── avatar
 ├── cardCount
 ├── isHost
 ├── isConnected
 └── eliminated


Never expose another player's actual cards to the client unless necessary.

The server should maintain authoritative hands.

17. CONNECTION HANDLING

Real-time games need good connection handling.

Show:

CONNECTED

when everything is working.

If connection drops:

CONNECTION LOST

with a small animated indicator.

Attempt automatic reconnection.

When reconnected:

BACK IN THE GAME!

Do not immediately kick a player because of a temporary network interruption.

Preserve their game state.

18. EMOTES / PLAYER REACTIONS

Add quick reactions during gameplay.

A small reaction button should open:

😂 😈 😭 🔥 😱 💀 👀

When a player sends an emoji:

It appears above their avatar

Floats upward

Fades out

Example:

😂

Multiple players should be able to react simultaneously.

This should create the feeling of playing with friends in the same room.

19. CHAT

Add an optional lightweight game chat.

Keep it secondary to gameplay.

Messages should appear in a compact panel.

Support:

Text messages

Quick reactions

Do not allow chat to cover the game table.

On mobile, use a bottom-sheet style chat panel.

20. SOUND DESIGN

Add a sound system.

Create placeholder sound hooks/assets for:

Card hover

Card selection

Card play

Card draw

Button click

Special card

Turn notification

Player join

Player leave

Win

Lose

Countdown

Include a sound toggle.

Also include a music toggle.

Do not autoplay music before user interaction.

Use subtle sounds during normal gameplay and stronger sounds for major events.

21. WIN SCREEN

When someone wins, transform the entire experience.

Show:

NO MERCY.

Then:

[PLAYER NAME] WINS!

Use:

Confetti

Flying cards

Screen flash

Particle burst

Large typography

Victory animation

Show final leaderboard:

🥇 Player

🥈 Player

🥉 Player

Then:

PLAY AGAIN

and

BACK TO LOBBY

buttons.

22. GAME STATISTICS

After the game, show a compact stats section.

Example:

Cards played

Cards drawn

Special cards played

Biggest draw

Fastest win

Total turns

Make this fun rather than overly analytical.

Example:

CHAOS LEVEL: 94%

MOST SAVAGE MOVE: ARJUN

BIGGEST DRAW: 14 CARDS

These can be calculated from the game event history.

23. AVATARS

Give players a selection of fun avatars.

Do not require profile pictures.

Provide approximately 12–20 stylized avatar choices.

Examples:

Skull

Devil

Fire

Crown

Robot

Alien

Tiger

Ghost

Lightning

Joker-style character

Monster

Cat

Keep them visually consistent.

Save the selected avatar for the session.

24. RESPONSIVE DESIGN

The game MUST work exceptionally well on:

Desktop

Laptop

Tablet

Android

iPhone

Prioritize mobile.

The game should be comfortably playable with one hand on a phone.

Use:

Touch-friendly cards

Large buttons

Horizontal card scrolling

Bottom sheets

Responsive player positioning

Do not simply shrink the desktop UI.

Create a genuinely responsive game layout.

25. MICROINTERACTIONS

Add lots of subtle feedback.

Examples:

Button hover:

Scale 1.03

Slight glow

Button press:

Scale 0.96

Card hover:

Lift

Rotate

Shadow

Player joins:

Slide in

Particle burst

Turn begins:

Glow pulse

Card played:

Fly animation

Winner:

Full-screen celebration

These interactions should make the application feel alive.

26. LOADING STATES

Never show a blank screen.

Use playful loading messages:

SHUFFLING THE CHAOS...

DEALING CARDS...

FINDING YOUR FRIENDS...

PREPARING NO MERCY...

Use animated card/deck graphics.

27. ERROR STATES

Make errors feel like part of the game.

Instead of:

Error 500

Use:

WELL... THAT BACKFIRED.

Then provide:

TRY AGAIN

For an invalid room:

THIS ROOM DOESN'T EXIST.

For a full room:

TOO MUCH CHAOS. ROOM IS FULL.

For a disconnected player:

PLAYER LOST CONNECTION.

28. ACCESSIBILITY

Despite the visual effects:

Maintain strong text contrast

Buttons must have readable labels

Support keyboard navigation

Provide reduced-motion support

Don't rely solely on color to indicate card validity

Ensure card symbols/numbers remain readable

Respect:

prefers-reduced-motion

and significantly reduce animations when enabled.

29. TECH STACK

Use a modern production-ready stack.

Prefer:

React

TypeScript

Vite

Tailwind CSS

Framer Motion

Supabase

PostgreSQL

Supabase Realtime

Use clean reusable components.

Suggested structure:

src/
 ├── components/
 │    ├── Card.tsx
 │    ├── PlayerAvatar.tsx
 │    ├── GameTable.tsx
 │    ├── PlayerHand.tsx
 │    ├── DrawPile.tsx
 │    ├── DiscardPile.tsx
 │    ├── TurnIndicator.tsx
 │    ├── ReactionPicker.tsx
 │    ├── GameChat.tsx
 │    ├── GameLobby.tsx
 │    └── VictoryScreen.tsx
 │
 ├── pages/
 │    ├── Home.tsx
 │    ├── CreateGame.tsx
 │    ├── JoinGame.tsx
 │    ├── Room.tsx
 │    └── Game.tsx
 │
 ├── game/
 │    ├── gameEngine.ts
 │    ├── deck.ts
 │    ├── rules.ts
 │    └── gameTypes.ts
 │
 ├── hooks/
 │    ├── useGame.ts
 │    ├── useRoom.ts
 │    ├── useRealtimeGame.ts
 │    └── useSound.ts
 │
 └── lib/
      ├── supabase.ts
      └── utils.ts


Keep components modular and maintainable.

30. DATABASE DESIGN

Create appropriate Supabase tables.

Suggested tables:

rooms

id

code

host_id

status

max_players

created_at

players

id

room_id

user/session ID

nickname

avatar

is_host

is_connected

joined_at

games

id

room_id

status

current_player_id

direction

pending_draw

discard_top

turn_started_at

winner_id

created_at

game_events

id

game_id

player_id

event_type

event_data

created_at

Use game events for statistics and debugging.

31. SECURITY

Do not trust the frontend.

Validate:

Room membership

Turn ownership

Valid card plays

Draw operations

Game state transitions

Host-only actions

Prevent players from:

Playing out of turn

Playing cards they don't own

Modifying their card count

Declaring themselves winner

Starting games without host privileges

Use Supabase Row Level Security appropriately.

32. GAME FLOW DETAILS

CREATE GAME

User clicks:

CREATE GAME

Generate room.

Show:

YOUR CHAOS ROOM IS READY

Room code:

X7K9P

Buttons:

COPY INVITE LINK

WAITING FOR FRIENDS...

JOIN GAME

User clicks:

JOIN GAME

Input:

ENTER ROOM CODE

Example:

X7K9P

Then:

JOIN CHAOS

Ask for:

CHOOSE YOUR NAME

and avatar.

WAITING ROOM

Show:

4 PLAYERS READY

Host:

START GAME

Everyone else:

WAITING FOR HOST...

GAME START

Full-screen animation:

GET READY

3

2

1

NO MERCY!

Then deal cards.

33. IMPORTANT UX RULE

The user should NEVER be confused about:

Whose turn it is

What cards they can play

What happened

Why they cannot play a card

How many cards each player has

What special effect just occurred

What they should do next

The game should always communicate the next action visually.

34. PERFORMANCE

Animations should feel smooth.

Target:

60 FPS animations

Avoid unnecessary rerenders

Use CSS transforms where possible

Optimize card rendering

Lazy-load non-critical assets

Avoid excessive DOM particles

Do not let visual effects make the actual game sluggish.

35. FINAL VISUAL QUALITY BAR

The finished product should feel like a real commercial multiplayer party game.

Think:

premium mobile game UI + chaotic card game + modern web technology.

It should be:

Fast

Bold

Playful

Addictive

Responsive

Highly animated

Social

Competitive

Easy to understand

Avoid anything that looks like a template.

36. BUILD PRIORITY

Build in this order:

Phase 1

Landing page + navigation + visual system

Phase 2

Create room + join room + lobby

Phase 3

Supabase real-time multiplayer

Phase 4

Actual game engine and card mechanics

Phase 5

Game table UI

Phase 6

Card interactions and animations

Phase 7

Special card effects

Phase 8

Reactions + chat

Phase 9

Victory screen + statistics

Phase 10

Mobile optimization + performance + error handling

37. VERY IMPORTANT: DON'T BUILD A MOCKUP

Do not stop at a beautiful frontend prototype.

I want a functional multiplayer game.

The following must actually work:

Create room

Join room

Multiple players

Real-time synchronization

Start game

Deal cards

Take turns

Play cards

Draw cards

Special card effects

Winner detection

Reconnection

Play again

Use realistic seeded/test data only during development.

Once the core functionality works, polish the animations and visual experience.

38. BRAND / GAME VIBE

The visual identity should communicate:

NO MERCY.

It should feel slightly mischievous, chaotic and competitive.

Use bold phrases throughout the experience:

READY?

LET'S GO.

YOUR TURN.

NO MERCY.

DRAW.

SKIPPED.

REVERSE.

CHAOS!

TOO MANY CARDS.

THAT HURT.

UNLUCKY.

NICE MOVE.

GAME OVER.

WINNER.

Keep copy short and energetic.

39. IMPORTANT LEGAL / BRANDING DETAIL

Use the name ONO No Mercy exactly where appropriate for this requested project, but do not copy proprietary artwork, logos, card illustrations, fonts, or visual assets from an existing commercial game.

Create an original visual identity that captures the chaotic, high-energy card-game vibe without reproducing copyrighted artwork.

Use original CSS/HTML/SVG-based card designs and original UI assets.

40. FINAL DELIVERABLE

Deliver a fully functional web application with:

Premium animated homepage

Create game

Join game

Private room system

Real-time multiplayer

Multiplayer lobby

Responsive game table

Interactive cards

Actual game logic

Special card animations

Player avatars

Reactions

Optional chat

Sound effects architecture

Victory screen

Statistics

Reconnect handling

Mobile-first responsive design

Supabase backend

Secure game-state validation

Before considering the project complete, test the game using multiple browser windows/devices simultaneously.

Open at least 3–4 simultaneous players and verify that:

Every player sees the same game state.

Turn changes synchronize correctly.

Card plays synchronize correctly.

Draws synchronize correctly.

Players joining/leaving works.

Special effects appear correctly.

The winner is correctly determined.

Reconnection does not destroy the game state.

The final result should feel like:

“I can send this link to 3 friends right now and we can actually play.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://unopack.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9860d9da-d81d-4e2f-9f1f-9c6c86663f7a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
