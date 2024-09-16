export interface User {
  id: string;
  username: string;
  avatar: string | null;
  permissions: "user" | "admin";
}

const getColorFromId = (id: string): string => {
  const hash = id.split("").reduce((acc, char) => {
    acc = ((acc << 5) - acc) + char.charCodeAt(0);
    return acc & acc;
  }, 0);
  return `hsl(${hash % 360}, 70%, 60%)`;
};

export const getUserImage = (user: User): string => {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="${getColorFromId(user.id)}"/>
      <text x="50%" y="50%" dy=".35em" fill="white" font-family="Arial" font-size="16" text-anchor="middle">
        ${user.username.charAt(0).toUpperCase()}
      </text>
    </svg>
  `)}`;
};