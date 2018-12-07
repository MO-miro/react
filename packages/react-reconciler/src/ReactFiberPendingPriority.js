/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {FiberRoot} from './ReactFiberRoot';
import type {ExpirationTime} from './ReactFiberExpirationTime';

import {NoWork} from './ReactFiberExpirationTime';

// TODO: Offscreen updates should never suspend. However, a promise that
// suspended inside an offscreen subtree should be able to ping at the priority
// of the outer render.

/**
 * @JSONZ 标识待处理事件的优先级
 */
export function markPendingPriorityLevel(
  root: FiberRoot,
  expirationTime: ExpirationTime,
): void {
  console.log('markPendingPriorityLevel',{ root, expirationTime});
  // 在完成一次失败的根和重试他之间，可能会额外的调度其他更新。?
  // 如果其他更新可以修复这个错误，则清除 didError
  // 在一次rootWork调度失败然后尝试的时候，可能会有其他额外的调度更新，如果其他的更新可以修复这个root failed，则清除didError
  // 还是不知所云

  // If there's a gap between completing a failed root and retrying it,
  // additional updates may be scheduled. Clear `didError`, in case the update
  // is sufficient to fix the error.
  root.didError = false;

  // @JSONZ 更新时间
  // Update the latest and earliest pending times
  const earliestPendingTime = root.earliestPendingTime;
  // 如果最早的待处理时间为 NoWork 则意味着没有其他需要处理的更新
  if (earliestPendingTime === NoWork) {
    // No other pending updates.
    root.earliestPendingTime = root.latestPendingTime = expirationTime;
  } else {
    if (earliestPendingTime < expirationTime) {
      // This is the earliest pending update.
      root.earliestPendingTime = expirationTime;
    } else {
      const latestPendingTime = root.latestPendingTime;
      if (latestPendingTime > expirationTime) {
        // This is the latest pending update
        root.latestPendingTime = expirationTime;
      }
    }
  }
  findNextExpirationTimeToWorkOn(expirationTime, root);
}

export function markCommittedPriorityLevels(
  root: FiberRoot,
  earliestRemainingTime: ExpirationTime,
): void {
  root.didError = false;

  if (earliestRemainingTime === NoWork) {
    // Fast path. There's no remaining work. Clear everything.
    root.earliestPendingTime = NoWork;
    root.latestPendingTime = NoWork;
    root.earliestSuspendedTime = NoWork;
    root.latestSuspendedTime = NoWork;
    root.latestPingedTime = NoWork;
    findNextExpirationTimeToWorkOn(NoWork, root);
    return;
  }

  // Let's see if the previous latest known pending level was just flushed.
  const latestPendingTime = root.latestPendingTime;
  if (latestPendingTime !== NoWork) {
    if (latestPendingTime > earliestRemainingTime) {
      // We've flushed all the known pending levels.
      root.earliestPendingTime = root.latestPendingTime = NoWork;
    } else {
      const earliestPendingTime = root.earliestPendingTime;
      if (earliestPendingTime > earliestRemainingTime) {
        // We've flushed the earliest known pending level. Set this to the
        // latest pending time.
        root.earliestPendingTime = root.latestPendingTime;
      }
    }
  }

  // Now let's handle the earliest remaining level in the whole tree. We need to
  // decide whether to treat it as a pending level or as suspended. Check
  // it falls within the range of known suspended levels.

  const earliestSuspendedTime = root.earliestSuspendedTime;
  if (earliestSuspendedTime === NoWork) {
    // There's no suspended work. Treat the earliest remaining level as a
    // pending level.
    markPendingPriorityLevel(root, earliestRemainingTime);
    findNextExpirationTimeToWorkOn(NoWork, root);
    return;
  }

  const latestSuspendedTime = root.latestSuspendedTime;
  if (earliestRemainingTime < latestSuspendedTime) {
    // The earliest remaining level is later than all the suspended work. That
    // means we've flushed all the suspended work.
    root.earliestSuspendedTime = NoWork;
    root.latestSuspendedTime = NoWork;
    root.latestPingedTime = NoWork;

    // There's no suspended work. Treat the earliest remaining level as a
    // pending level.
    markPendingPriorityLevel(root, earliestRemainingTime);
    findNextExpirationTimeToWorkOn(NoWork, root);
    return;
  }

  if (earliestRemainingTime > earliestSuspendedTime) {
    // The earliest remaining time is earlier than all the suspended work.
    // Treat it as a pending update.
    markPendingPriorityLevel(root, earliestRemainingTime);
    findNextExpirationTimeToWorkOn(NoWork, root);
    return;
  }

  // The earliest remaining time falls within the range of known suspended
  // levels. We should treat this as suspended work.
  findNextExpirationTimeToWorkOn(NoWork, root);
}

export function hasLowerPriorityWork(
  root: FiberRoot,
  erroredExpirationTime: ExpirationTime,
): boolean {
  const latestPendingTime = root.latestPendingTime;
  const latestSuspendedTime = root.latestSuspendedTime;
  const latestPingedTime = root.latestPingedTime;
  return (
    (latestPendingTime !== NoWork &&
      latestPendingTime < erroredExpirationTime) ||
    (latestSuspendedTime !== NoWork &&
      latestSuspendedTime < erroredExpirationTime) ||
    (latestPingedTime !== NoWork && latestPingedTime < erroredExpirationTime)
  );
}

export function isPriorityLevelSuspended(
  root: FiberRoot,
  expirationTime: ExpirationTime,
): boolean {
  const earliestSuspendedTime = root.earliestSuspendedTime;
  const latestSuspendedTime = root.latestSuspendedTime;
  return (
    earliestSuspendedTime !== NoWork &&
    expirationTime <= earliestSuspendedTime &&
    expirationTime >= latestSuspendedTime
  );
}

export function markSuspendedPriorityLevel(
  root: FiberRoot,
  suspendedTime: ExpirationTime,
): void {
  root.didError = false;
  clearPing(root, suspendedTime);

  // First, check the known pending levels and update them if needed.
  const earliestPendingTime = root.earliestPendingTime;
  const latestPendingTime = root.latestPendingTime;
  if (earliestPendingTime === suspendedTime) {
    if (latestPendingTime === suspendedTime) {
      // Both known pending levels were suspended. Clear them.
      root.earliestPendingTime = root.latestPendingTime = NoWork;
    } else {
      // The earliest pending level was suspended. Clear by setting it to the
      // latest pending level.
      root.earliestPendingTime = latestPendingTime;
    }
  } else if (latestPendingTime === suspendedTime) {
    // The latest pending level was suspended. Clear by setting it to the
    // latest pending level.
    root.latestPendingTime = earliestPendingTime;
  }

  // Finally, update the known suspended levels.
  const earliestSuspendedTime = root.earliestSuspendedTime;
  const latestSuspendedTime = root.latestSuspendedTime;
  if (earliestSuspendedTime === NoWork) {
    // No other suspended levels.
    root.earliestSuspendedTime = root.latestSuspendedTime = suspendedTime;
  } else {
    if (earliestSuspendedTime < suspendedTime) {
      // This is the earliest suspended level.
      root.earliestSuspendedTime = suspendedTime;
    } else if (latestSuspendedTime > suspendedTime) {
      // This is the latest suspended level
      root.latestSuspendedTime = suspendedTime;
    }
  }

  findNextExpirationTimeToWorkOn(suspendedTime, root);
}

export function markPingedPriorityLevel(
  root: FiberRoot,
  pingedTime: ExpirationTime,
): void {
  root.didError = false;

  // TODO: When we add back resuming, we need to ensure the progressed work
  // is thrown out and not reused during the restarted render. One way to
  // invalidate the progressed work is to restart at expirationTime + 1.
  const latestPingedTime = root.latestPingedTime;
  if (latestPingedTime === NoWork || latestPingedTime > pingedTime) {
    root.latestPingedTime = pingedTime;
  }
  findNextExpirationTimeToWorkOn(pingedTime, root);
}

function clearPing(root, completedTime) {
  // TODO: Track whether the root was pinged during the render phase. If so,
  // we need to make sure we don't lose track of it.
  const latestPingedTime = root.latestPingedTime;
  if (latestPingedTime !== NoWork && latestPingedTime >= completedTime) {
    root.latestPingedTime = NoWork;
  }
}

export function findEarliestOutstandingPriorityLevel(
  root: FiberRoot,
  renderExpirationTime: ExpirationTime,
): ExpirationTime {
  let earliestExpirationTime = renderExpirationTime;

  const earliestPendingTime = root.earliestPendingTime;
  const earliestSuspendedTime = root.earliestSuspendedTime;
  if (earliestPendingTime > earliestExpirationTime) {
    earliestExpirationTime = earliestPendingTime;
  }
  if (earliestSuspendedTime > earliestExpirationTime) {
    earliestExpirationTime = earliestSuspendedTime;
  }
  return earliestExpirationTime;
}

export function didExpireAtExpirationTime(
  root: FiberRoot,
  currentTime: ExpirationTime,
): void {
  const expirationTime = root.expirationTime;
  if (expirationTime !== NoWork && currentTime <= expirationTime) {
    // The root has expired. Flush all work up to the current time.
    root.nextExpirationTimeToWorkOn = currentTime;
  }
}

/**
 * @JSONZ 获取下一个工作的优先级， and 下一个优先级to work on
 */
function findNextExpirationTimeToWorkOn(completedExpirationTime, root) {
  console.log('findNextExpirationTimeToWorkOn', {completedExpirationTime, root});
  const earliestSuspendedTime = root.earliestSuspendedTime;
  const latestSuspendedTime = root.latestSuspendedTime;
  const earliestPendingTime = root.earliestPendingTime;
  const latestPingedTime = root.latestPingedTime;

  // 如果可以的话，就在最早待处理时间去 work，否则就最晚待处理时间。
  // Work on the earliest pending time. Failing that, work on the latest
  // pinged time.
  let nextExpirationTimeToWorkOn =
    earliestPendingTime !== NoWork ? earliestPendingTime : latestPingedTime;

  // 下面这段无法理解
  // 如果没有待处理或针对性的工作，可以检查一下比目前完成任务更低优先级的或者暂停了的活动
  // If there is no pending or pinted work, check if there's suspended work
  // that's lower priority than what we just completed.
  if (
    nextExpirationTimeToWorkOn === NoWork &&
    (completedExpirationTime === NoWork ||
      latestSuspendedTime < completedExpirationTime)
  ) {
    // 最低优先级的工作是最有可能下次提交？ 让我们再次render他，所以如果超时，我们就可以准备提交？ 奇奇怪怪的
    // The lowest priority suspended work is the work most likely to be
    // committed next. Let's start rendering it again, so that if it times out,
    // it's ready to commit.
    nextExpirationTimeToWorkOn = latestSuspendedTime;
  }

  let expirationTime = nextExpirationTimeToWorkOn;
  if (expirationTime !== NoWork && earliestSuspendedTime > expirationTime) {

    // Expire using the earliest known expiration time.
    expirationTime = earliestSuspendedTime;
  }

  root.nextExpirationTimeToWorkOn = nextExpirationTimeToWorkOn;
  root.expirationTime = expirationTime;
}
