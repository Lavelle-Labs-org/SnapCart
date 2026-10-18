import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        // Avoid double-wrapping if the payload is already enveloped
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }
        return {
          success: true,
          data,
        };
      })
    );
  }
}
