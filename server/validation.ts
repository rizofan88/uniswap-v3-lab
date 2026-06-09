import type { Request } from "express";
import { BadRequestError } from "./errors";

type QuoteQuery = {
  tokenIn: string,
  tokenOut: string,
  amount: string
}

type WalletSummaryQuery = {
  address: string,
  sessionId: string
}

type SwapRequestBody = {
  sessionId: string,
  tokenIn: string,
  tokenOut: string,
  amount: string,
  account: string
}

function getStringQueryParam(req: Request, key: string): string {
  const value = req.query[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestError(`Missing ${key}`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new BadRequestError(`Missing ${key}`);
  }
  return value;
}

function getBodyParams(req: Request, key: string) {
  const value = req.body[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestError(`Missing ${key}`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new BadRequestError(`Missing ${key}`);
  }
  return value;
}

export function validateSessionId(sessionId: unknown): string {

  if (typeof sessionId !== "string") {
    throw new BadRequestError("Missing sessionId.");
  }

  const id = sessionId.trim();

  if (id.length === 0) {
    throw new BadRequestError("Missing sessionId.");
  }

  return id;
}

export function validateQuoteQuery(req: Request): QuoteQuery {
  const tokenIn = getStringQueryParam(req, "tokenIn");
  const tokenOut = getStringQueryParam(req, "tokenOut");
  const amount = getStringQueryParam(req, "amount");

  if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new BadRequestError("Invalid quote amount.");
  }

  return {
    tokenIn,
    tokenOut,
    amount,
  };
}

export function validateWalletSummaryQuery(req: Request): WalletSummaryQuery {
  const address = getStringQueryParam(req, "address");
  const sessionId = getStringQueryParam(req, "sessionId");

  return {
    address,
    sessionId
  }

}

export function validateSwapBodyParams(req: Request): SwapRequestBody {

  const sessionId = getBodyParams(req, "sessionId");
  const tokenIn = getBodyParams(req, "tokenIn");
  const tokenOut = getBodyParams(req, "tokenOut");
  const amount = getBodyParams(req, "amount");
  const account = getBodyParams(req, "account");

  if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new BadRequestError("Invalid swap amount.");
  }

  return {
    sessionId,
    tokenIn,
    tokenOut,
    amount,
    account
  }
}