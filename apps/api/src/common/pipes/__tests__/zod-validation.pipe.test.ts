import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ArgumentMetadata, HttpException, HttpStatus } from "@nestjs/common";
import { ZodValidationPipe, createZodDto } from "../zod-validation.pipe";

describe("ZodValidationPipe (PR-017, Issue #136)", () => {
  const testSchema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive().optional(),
  });

  class TestDto extends createZodDto(testSchema) {}

  const metadata: ArgumentMetadata = {
    type: "body",
    metatype: TestDto,
    data: "",
  };

  it("strips unwhitelisted properties from payload by default (whitelist: true)", () => {
    const pipe = new ZodValidationPipe({ whitelist: true });
    const input = {
      name: "Abebe",
      age: 30,
      unwhitelistedParam: "malicious_payload",
      isAdmin: true,
    };

    const result = pipe.transform(input, metadata);

    expect(result).toEqual({
      name: "Abebe",
      age: 30,
    });
    expect((result as any).unwhitelistedParam).toBeUndefined();
    expect((result as any).isAdmin).toBeUndefined();
  });

  it("throws HttpException 400 with VALIDATION_ERROR when input is invalid", () => {
    const pipe = new ZodValidationPipe({ whitelist: true });
    const invalidInput = {
      name: "A", // too short (min 2)
    };

    expect(() => pipe.transform(invalidInput, metadata)).toThrow(HttpException);

    try {
      pipe.transform(invalidInput, metadata);
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const res = err.getResponse();
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.details).toBeDefined();
    }
  });

  it("throws HttpException 400 when forbidNonWhitelisted is true and unknown properties exist", () => {
    const pipe = new ZodValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
    const input = {
      name: "Abebe",
      forbiddenField: "not_allowed",
    };

    expect(() => pipe.transform(input, metadata)).toThrow(HttpException);

    try {
      pipe.transform(input, metadata);
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const res = err.getResponse();
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.message).toContain("forbiddenField");
    }
  });

  it("leaves value untouched when metadata type is not body and no explicit schema given", () => {
    const pipe = new ZodValidationPipe({ whitelist: true });
    const queryMeta: ArgumentMetadata = {
      type: "query",
      metatype: String,
      data: "q",
    };

    const result = pipe.transform("some-search", queryMeta);
    expect(result).toBe("some-search");
  });

  it("leaves value untouched when metatype is plain Object without schema", () => {
    const pipe = new ZodValidationPipe({ whitelist: true });
    const plainMeta: ArgumentMetadata = {
      type: "body",
      metatype: Object,
      data: "",
    };

    const webhookBody = { event: "delivery", raw: 12345 };
    const result = pipe.transform(webhookBody, plainMeta);
    expect(result).toEqual(webhookBody);
  });

  it("handles schemas with refinements (ZodEffects) properly", () => {
    const refinedSchema = z
      .object({
        priceSantim: z.number().optional(),
        priceBirr: z.number().optional(),
      })
      .refine((data) => data.priceSantim !== undefined || data.priceBirr !== undefined, {
        message: "Price is required",
      });

    class RefinedDto extends createZodDto(refinedSchema) {}

    const refinedMeta: ArgumentMetadata = {
      type: "body",
      metatype: RefinedDto,
      data: "",
    };

    const pipe = new ZodValidationPipe({ whitelist: true });
    const input = {
      priceBirr: 50,
      extraUnwhitelisted: "strip_me",
    };

    const result = pipe.transform(input, refinedMeta);
    expect(result).toEqual({ priceBirr: 50 });
    expect((result as any).extraUnwhitelisted).toBeUndefined();
  });
});
