export interface User {
  id: string;
  username: string;
  avatar: string;
}

export const getUserImage = (user: User) => {
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}