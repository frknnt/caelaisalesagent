import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Removes one Next.js build directory directly under the repository root. */
export function cleanNextDirectory(distDir) {
  const buildDirectory = resolve(repositoryRoot, distDir);
  if (
    dirname(buildDirectory) !== repositoryRoot ||
    !/^\.next(?:-[a-z0-9]+)*$/.test(distDir)
  ) {
    throw new Error(
      "Refusing to clean a build directory outside the repository root.",
    );
  }

  rmSync(buildDirectory, { force: true, recursive: true });

  // Windows may release deleted build-directory handles asynchronously after
  // previous Node workers exit. A short synchronous grace period prevents the
  // following build from racing that release.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
}
