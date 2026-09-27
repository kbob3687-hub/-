import test from "node:test";
import assert from "node:assert/strict";
import { floatPose, tunnelPose, interpolatePose, TUNNEL_NEAR, TUNNEL_SPACING } from "../lib/gallery-space.ts";

test("endless tunnel wraps forwards and backwards without nonfinite poses", () => {
  for (const count of [1, 2, 8]) for (const camera of [-100000, -460, 0, 900, 100000]) {
    for (let index = 0; index < count; index++) {
      const pose = tunnelPose(index, count, 1440, 760, camera);
      const loop = tunnelPose(index, count, 1440, 760, camera + count * TUNNEL_SPACING);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.z <= TUNNEL_NEAR && pose.z > TUNNEL_NEAR - count * TUNNEL_SPACING);
      assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
      assert.equal(pose.z, loop.z);
    }
  }
});

test("float positions and transitions support small mobile galleries", () => {
  for (const count of [1, 2, 8]) for (let index = 0; index < count; index++) {
    const float = floatPose(index, count, 390, 740, 50);
    const tunnel = tunnelPose(index, count, 390, 740, 0);
    assert.ok(Object.values(float).every(Number.isFinite));
    assert.deepEqual(interpolatePose(float, tunnel, 0), float);
    const destination = interpolatePose(float, tunnel, 1);
    for (const key of Object.keys(tunnel)) assert.ok(Math.abs(destination[key] - tunnel[key]) < 1e-9);
  }
});
