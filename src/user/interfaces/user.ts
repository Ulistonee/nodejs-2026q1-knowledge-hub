export interface User {
  id: string;
  login: string;
  password: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type PublicUser = Omit<User, 'password'>;