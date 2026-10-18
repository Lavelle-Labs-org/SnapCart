import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentSeller = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const seller = request.user || request.seller;
    if (!seller) return null;
    return data ? seller[data] : seller;
  }
);
