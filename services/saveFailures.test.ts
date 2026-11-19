import { expect, test } from "bun:test";
import {
  hasSaveFailed,
  saveInBackground,
  watchSaveFailures,
} from "./saveFailures";

/** Lets the promises settled so far run what waits on them. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a save that goes through reports nothing", async () => {
  saveInBackground(Promise.resolve());
  await settled();
  expect(hasSaveFailed()).toBe(false);
});

test("a save that fails is reported, once, to those who watch", async () => {
  let heard = 0;
  const stop = watchSaveFailures(() => {
    heard += 1;
  });
  saveInBackground(Promise.reject(new Error("Disk full")));
  saveInBackground(Promise.reject(new Error("Disk full")));
  await settled();
  expect(hasSaveFailed()).toBe(true);
  expect(heard).toBe(1);
  stop();
});
