import { beforeEach } from "vitest";
import { installChromeFake, type StorageFake } from "./chromeFake";

/** Fresh, empty storage for every test — set up here so no test can forget to. */
export let storage: StorageFake;

beforeEach(() => {
    storage = installChromeFake();
});
