export interface AvatarDef {
  id: string;
  emoji: string;
  label: string;
  hue: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "skull", emoji: "💀", label: "Skull", hue: "var(--ono-red)" },
  { id: "devil", emoji: "😈", label: "Devil", hue: "var(--ono-violet)" },
  { id: "fire", emoji: "🔥", label: "Fire", hue: "var(--ono-red)" },
  { id: "crown", emoji: "👑", label: "Crown", hue: "var(--ono-yellow)" },
  { id: "robot", emoji: "🤖", label: "Robot", hue: "var(--ono-blue)" },
  { id: "alien", emoji: "👽", label: "Alien", hue: "var(--ono-green)" },
  { id: "tiger", emoji: "🐯", label: "Tiger", hue: "var(--ono-yellow)" },
  { id: "ghost", emoji: "👻", label: "Ghost", hue: "var(--ono-blue)" },
  { id: "bolt", emoji: "⚡", label: "Bolt", hue: "var(--ono-yellow)" },
  { id: "joker", emoji: "🃏", label: "Joker", hue: "var(--ono-violet)" },
  { id: "monster", emoji: "👹", label: "Monster", hue: "var(--ono-red)" },
  { id: "cat", emoji: "🐱", label: "Cat", hue: "var(--ono-yellow)" },
  { id: "shark", emoji: "🦈", label: "Shark", hue: "var(--ono-blue)" },
  { id: "dragon", emoji: "🐲", label: "Dragon", hue: "var(--ono-green)" },
  { id: "clown", emoji: "🤡", label: "Clown", hue: "var(--ono-red)" },
  { id: "ninja", emoji: "🥷", label: "Ninja", hue: "var(--ono-violet)" },
  { id: "bomb", emoji: "💣", label: "Bomb", hue: "var(--ono-red)" },
  { id: "ufo", emoji: "🛸", label: "UFO", hue: "var(--ono-green)" },
  { id: "cyclone", emoji: "🌪️", label: "Cyclone", hue: "var(--ono-blue)" },
  { id: "gem", emoji: "💎", label: "Gem", hue: "var(--ono-blue)" },
];

export function avatarOf(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}
