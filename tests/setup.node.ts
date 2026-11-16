import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { resetFactories } from "./factories";

beforeEach(() => {
  resetFactories();
});
