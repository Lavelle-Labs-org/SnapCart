import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { z } from "zod";

export interface ZodValidationPipeOptions {
  /**
   * If true (default), unwhitelisted properties not defined in the schema
   * are stripped from the payload prior to controller execution.
   */
  whitelist?: boolean;
  /**
   * If true, throws a 400 VALIDATION_ERROR if any unwhitelisted properties are present.
   * Defaults to false.
   */
  forbidNonWhitelisted?: boolean;
}

/**
 * Creates an augmented class representing a Zod-backed DTO with metadata
 * preserved at runtime for NestJS argument reflection and Pipe validation.
 */
export function createZodDto<T extends z.ZodTypeAny>(schema: T) {
  class AugmentedZodDto {
    public static readonly schema = schema;
    public static readonly isZodDto = true;
  }
  return AugmentedZodDto as unknown as {
    new (): z.infer<T>;
    schema: T;
    isZodDto: boolean;
  };
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly schema?: z.ZodTypeAny;
  private readonly options: ZodValidationPipeOptions;

  constructor(optionsOrSchema?: ZodValidationPipeOptions | z.ZodTypeAny) {
    if (
      optionsOrSchema &&
      ("safeParse" in optionsOrSchema || "_def" in optionsOrSchema)
    ) {
      this.schema = optionsOrSchema as z.ZodTypeAny;
      this.options = { whitelist: true, forbidNonWhitelisted: false };
    } else {
      const opts = (optionsOrSchema as ZodValidationPipeOptions) || {};
      this.options = {
        whitelist: opts.whitelist !== false,
        forbidNonWhitelisted: Boolean(opts.forbidNonWhitelisted),
      };
    }
  }

  public transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only inspect body payloads (or custom-bound parameter schemas)
    if (metadata.type !== "body" && metadata.type !== "custom") {
      return value;
    }

    const schema = this.resolveSchema(metadata);
    if (!schema) {
      return value;
    }

    if (
      this.options.forbidNonWhitelisted &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      this.checkForForbiddenProperties(
        value as Record<string, unknown>,
        schema
      );
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      const firstIssue = (result.error as any).issues?.[0] || (result.error as any).errors?.[0];
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: firstIssue?.message || "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // result.data only contains whitelisted properties defined in the schema
    return this.options.whitelist ? result.data : value;
  }

  private resolveSchema(metadata: ArgumentMetadata): z.ZodTypeAny | undefined {
    if (this.schema) {
      return this.schema;
    }
    const metatype = metadata.metatype as any;
    if (metatype && typeof metatype === "function" && metatype.schema) {
      return metatype.schema as z.ZodTypeAny;
    }
    if (metatype && typeof metatype.safeParse === "function") {
      return metatype as z.ZodTypeAny;
    }
    return undefined;
  }

  private checkForForbiddenProperties(
    value: Record<string, unknown>,
    schema: z.ZodTypeAny
  ): void {
    const allowedKeys = this.extractAllowedKeys(schema);
    if (!allowedKeys) {
      return;
    }
    const unwhitelisted = Object.keys(value).filter((key) => !allowedKeys.has(key));
    if (unwhitelisted.length > 0) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: `Property ${unwhitelisted[0]} should not exist`,
          details: unwhitelisted.map((k) => `Property ${k} should not exist`),
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private extractAllowedKeys(schema: z.ZodTypeAny): Set<string> | undefined {
    let current: any = schema;
    while (current && current._def && current._def.schema) {
      current = current._def.schema;
    }
    if (current && "shape" in current && typeof current.shape === "object") {
      return new Set(Object.keys(current.shape));
    }
    return undefined;
  }
}
