export interface JwtPayload {
  sub: string; // id
  email: string;
  platformId?: string;
}
