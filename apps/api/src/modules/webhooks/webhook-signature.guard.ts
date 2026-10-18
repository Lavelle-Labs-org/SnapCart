import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { CryptoService } from "../crypto/crypto.service";
import { env } from "../../config/env";

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const signature =
      request.headers["x-smshub-signature"] ||
      request.headers["X-SMSHub-Signature"];

    if (!signature || typeof signature !== "string") {
      throw new HttpException(
        {
          code: "MISSING_SIGNATURE",
          message: "Missing required X-SMSHub-Signature header",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const secret =
      process.env.SMSHUB_WEBHOOK_SECRET ||
      (() => {
        try {
          return env.SMSHUB_WEBHOOK_SECRET;
        } catch {
          return undefined;
        }
      })();

    if (!secret) {
      throw new HttpException(
        {
          code: "MISSING_SIGNATURE_SECRET",
          message: "SMSHUB_WEBHOOK_SECRET is not configured on server",
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    let rawBody = "";
    if (request.rawBody && Buffer.isBuffer(request.rawBody)) {
      rawBody = request.rawBody.toString("utf8");
    } else if (typeof request.body === "string") {
      rawBody = request.body;
    } else if (request.body && typeof request.body === "object") {
      rawBody = JSON.stringify(request.body);
    }

    const verification = this.cryptoService.verifySMSHubWebhookSignature(
      rawBody,
      signature,
      secret
    );

    if (!verification.isValid) {
      const err = verification.error || "Invalid webhook signature";
      let code = "INVALID_SIGNATURE";
      if (err.toLowerCase().includes("expired")) {
        code = "EXPIRED_SIGNATURE";
      } else if (err.toLowerCase().includes("malformed")) {
        code = "MALFORMED_SIGNATURE";
      }

      throw new HttpException(
        {
          code,
          message: `Webhook signature verification failed: ${err}`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    request.verifiedRawBody = rawBody;
    return true;
  }
}
