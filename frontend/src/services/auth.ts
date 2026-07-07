export type FlowPilotUser = {
  email: string;
  name?: string;
};

const AUTH_KEY = "flowpilot-auth";
const USER_KEY = "flowpilot-user";
const USERS_KEY = "flowpilot-users";

type StoredUser = FlowPilotUser & {
  password: string;
};

function readUsers(): StoredUser[] {
  try {
    const rawUsers = window.localStorage.getItem(USERS_KEY);
    return rawUsers ? JSON.parse(rawUsers) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setSession(user: FlowPilotUser) {
  window.localStorage.setItem(AUTH_KEY, "true");
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated() {
  return typeof window !== "undefined" && window.localStorage.getItem(AUTH_KEY) === "true";
}

export function getCurrentUser(): FlowPilotUser | null {
  if (!isAuthenticated()) {
    return null;
  }

  try {
    const rawUser = window.localStorage.getItem(USER_KEY);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();
  const existingUser = users.find((user) => user.email.toLowerCase() === normalizedEmail);

  if (existingUser && existingUser.password !== password) {
    throw new Error("The password does not match this FlowPilot account.");
  }

  const user = existingUser ?? { email: normalizedEmail, password, name: normalizedEmail.split("@")[0] };
  if (!existingUser) {
    writeUsers([...users, user]);
  }

  setSession({ email: user.email, name: user.name });
  return { email: user.email, name: user.name };
}

export function signUp(email: string, password: string, name?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error("An account already exists for this email. Please log in instead.");
  }

  const user = { email: normalizedEmail, password, name: name?.trim() || normalizedEmail.split("@")[0] };
  writeUsers([...users, user]);
  setSession({ email: user.email, name: user.name });
  return { email: user.email, name: user.name };
}

export function logout() {
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(USER_KEY);
}
