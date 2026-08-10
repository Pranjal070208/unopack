const SESSION_KEY = "ono_session_id";
const NAME_KEY = "ono_nickname";
const AVATAR_KEY = "ono_avatar";

export interface RoomCreds {
  playerId: string;
  secret: string;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function saveProfile(nickname: string, avatar: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, nickname);
  localStorage.setItem(AVATAR_KEY, avatar);
}

export function loadProfile(): { nickname: string; avatar: string } {
  if (typeof window === "undefined") return { nickname: "", avatar: "skull" };
  return {
    nickname: localStorage.getItem(NAME_KEY) ?? "",
    avatar: localStorage.getItem(AVATAR_KEY) ?? "skull",
  };
}

export function saveCreds(code: string, creds: RoomCreds) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`ono_creds_${code.toUpperCase()}`, JSON.stringify(creds));
}

export function loadCreds(code: string): RoomCreds | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`ono_creds_${code.toUpperCase()}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomCreds;
  } catch {
    return null;
  }
}

export function clearCreds(code: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`ono_creds_${code.toUpperCase()}`);
}
