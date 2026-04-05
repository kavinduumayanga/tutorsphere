import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { getJwtSecret } from '../config/securityConfig.js';

type JwtSignPayload = string | Buffer | object;

export const signJwt = (payload: JwtSignPayload, options?: SignOptions): string => {
  return jwt.sign(payload, getJwtSecret(), options);
};

export const verifyJwt = <T extends JwtPayload | string = JwtPayload>(token: string): T => {
  return jwt.verify(token, getJwtSecret()) as T;
};
