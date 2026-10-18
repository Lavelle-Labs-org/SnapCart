import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE_NAME } from "./auth.types";

export function extractTokenFromRequest(req: any): string | null {
  if (!req) return null;

  // 1. Cookie object on Request (e.g. cookie-parser)
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  // 2. Cookie header parsing
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === "string") {
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      return decodeURIComponent(match.substring(SESSION_COOKIE_NAME.length + 1));
    }
  }

  // 3. Authorization Bearer header
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

@Injectable()
export class SellerAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractTokenFromRequest(request);

    if (!token) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Unauthorized: Missing session token",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const session = await this.authService.verifySessionToken(token);

    const seller = await this.authService.getSellerById(session.sellerId);
    if (!seller) {
      throw new HttpException(
        {
          code: "SELLER_NOT_FOUND",
          message: "Unauthorized: Seller account not found",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    request.user = seller;
    request.seller = seller;
    return true;
  }
}
