/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from './ReactFiber';
import type {FiberRoot} from './ReactFiberRoot';
import type {
  Instance,
  TextInstance,
  Container,
  PublicInstance,
} from './ReactFiberHostConfig';
import type {ReactNodeList} from 'shared/ReactTypes';
import type {ExpirationTime} from './ReactFiberExpirationTime';

import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals,
} from 'react-reconciler/reflection';
import * as ReactInstanceMap from 'shared/ReactInstanceMap';
import {HostComponent} from 'shared/ReactTypeOfWork';
import getComponentName from 'shared/getComponentName';
import invariant from 'shared/invariant';
import warningWithoutStack from 'shared/warningWithoutStack';

import {getPublicInstance} from './ReactFiberHostConfig';
import {
  findCurrentUnmaskedContext,
  isContextProvider,
  processChildContext,
  emptyContextObject,
} from './ReactFiberContext';
import {createFiberRoot} from './ReactFiberRoot';
import * as ReactFiberDevToolsHook from './ReactFiberDevToolsHook';
import {
  computeUniqueAsyncExpiration,
  requestCurrentTime,
  computeExpirationForFiber,
  scheduleWork,
  requestWork,
  flushRoot,
  batchedUpdates,
  unbatchedUpdates,
  flushSync,
  flushControlled,
  deferredUpdates,
  syncUpdates,
  interactiveUpdates,
  flushInteractiveUpdates,
} from './ReactFiberScheduler';
import {createUpdate, enqueueUpdate} from './ReactUpdateQueue';
import ReactFiberInstrumentation from './ReactFiberInstrumentation';
import * as ReactCurrentFiber from './ReactCurrentFiber';

type OpaqueRoot = FiberRoot;

// 0 is PROD, 1 is DEV.
// Might add PROFILE later.
type BundleType = 0 | 1;

type DevToolsConfig = {|
  bundleType: BundleType,
  version: string,
  rendererPackageName: string,
  // Note: this actually *does* depend on Fiber internal fields.
  // Used by "inspect clicked DOM element" in React DevTools.
  findFiberByHostInstance?: (instance: Instance | TextInstance) => Fiber,
  // Used by RN in-app inspector.
  // This API is unfortunately RN-specific.
  // TODO: Change it to accept Fiber instead and type it properly.
  getInspectorDataForViewTag?: (tag: number) => Object,
|};

let didWarnAboutNestedUpdates;

if (__DEV__) {
  didWarnAboutNestedUpdates = false;
}

/**
 * @JSONZ
 * 获取子树上下文
 */
function getContextForSubtree(
  parentComponent: ?React$Component<any, any>,
): Object {
  console.log('getContextForSubtree root组件会返回emptyContextObject');
  // 如果没有父组件，则是一个空的obj （既root组件)
  if (!parentComponent) {
    return emptyContextObject;
  }
  console.log('getContextForSubtree 有parentComponent的情况还没遇到过');
  debugger;
  const fiber = ReactInstanceMap.get(parentComponent);
  const parentContext = findCurrentUnmaskedContext(fiber);
  return isContextProvider(fiber)
    ? processChildContext(fiber, parentContext)
    : parentContext;
}

/**
 * @JSONZ
 * root 调度更新方法
 */
function scheduleRootUpdate(
  current: Fiber,
  element: ReactNodeList,
  expirationTime: ExpirationTime,
  callback: ?Function,
) {
  console.log('scheduleRootUpdate', {
    current, element, expirationTime,
  });
  if (__DEV__) {
    if (
      ReactCurrentFiber.phase === 'render' &&
      ReactCurrentFiber.current !== null &&
      !didWarnAboutNestedUpdates
    ) {
      didWarnAboutNestedUpdates = true;
      warningWithoutStack(
        false,
        'Render methods should be a pure function of props and state; ' +
          'triggering nested component updates from render is not allowed. ' +
          'If necessary, trigger nested updates in componentDidUpdate.\n\n' +
          'Check the render method of %s.',
        getComponentName(ReactCurrentFiber.current.type) || 'Unknown',
      );
    }
  }

  // 传入执行优先级创建一个update对象
  const update = createUpdate(expirationTime);
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = {element};

  // 这里的cb 一般是 commit 提交的步骤
  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    warningWithoutStack(
      typeof callback === 'function',
      'render(...): Expected the last optional `callback` argument to be a ' +
        'function. Instead received: %s.',
      callback,
    );
    update.callback = callback;
  }

  // 进入更新队列咯
  // 把要更新的东西丢到更新队列里面
  enqueueUpdate(current, update);

  // 调度工作
  scheduleWork(current, expirationTime);
  return expirationTime;
}

export function updateContainerAtExpirationTime(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  expirationTime: ExpirationTime,
  callback: ?Function,
) {
  // TODO: If this is a nested container, this won't be the root.
  const current = container.current;

  if (__DEV__) {
    if (ReactFiberInstrumentation.debugTool) {
      if (current.alternate === null) {
        ReactFiberInstrumentation.debugTool.onMountContainer(container);
      } else if (element === null) {
        ReactFiberInstrumentation.debugTool.onUnmountContainer(container);
      } else {
        ReactFiberInstrumentation.debugTool.onUpdateContainer(container);
      }
    }
  }

  // @JSONZ 获取子树的上下文
  const context = getContextForSubtree(parentComponent);

  // @JSONZ 更新上下文，当前没有执行就更新当前上下文，否则丢到待处理的上下文
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  // 调度 root 更新
  return scheduleRootUpdate(current, element, expirationTime, callback);
}

function findHostInstance(component: Object): PublicInstance | null {
  const fiber = ReactInstanceMap.get(component);
  if (fiber === undefined) {
    if (typeof component.render === 'function') {
      invariant(false, 'Unable to find node on an unmounted component.');
    } else {
      invariant(
        false,
        'Argument appears to not be a ReactComponent. Keys: %s',
        Object.keys(component),
      );
    }
  }
  const hostFiber = findCurrentHostFiber(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

export function createContainer(
  containerInfo: Container,
  isAsync: boolean,
  hydrate: boolean,
): OpaqueRoot {
  return createFiberRoot(containerInfo, isAsync, hydrate);
}

export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function,
): ExpirationTime {
  const current = container.current;
  // 获取当前的时间
  const currentTime = requestCurrentTime();

  // 计算fiber处理的优先级 里面根据各种优先级去处理返回，比如sync interactive async
  const expirationTime = computeExpirationForFiber(currentTime, current);

  /**
   * @JSONZ 在时间到期内更新容器
   * element => React Element
   * container => 容器 Fiber Root
   * expirationTim=> 工作的优先级
   * callback => emmmmm
   */
  return updateContainerAtExpirationTime(
    element,
    container,
    parentComponent,
    expirationTime,
    callback,
  );
}

export {
  flushRoot,
  requestWork,
  computeUniqueAsyncExpiration,
  batchedUpdates,
  unbatchedUpdates,
  deferredUpdates,
  syncUpdates,
  interactiveUpdates,
  flushInteractiveUpdates,
  flushControlled,
  flushSync,
};

export function getPublicRootInstance(
  container: OpaqueRoot,
): React$Component<any, any> | PublicInstance | null {
  const containerFiber = container.current;
  if (!containerFiber.child) {
    return null;
  }
  switch (containerFiber.child.tag) {
    case HostComponent:
      return getPublicInstance(containerFiber.child.stateNode);
    default:
      return containerFiber.child.stateNode;
  }
}

export {findHostInstance};

export function findHostInstanceWithNoPortals(
  fiber: Fiber,
): PublicInstance | null {
  const hostFiber = findCurrentHostFiberWithNoPortals(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

export function injectIntoDevTools(devToolsConfig: DevToolsConfig): boolean {
  const {findFiberByHostInstance} = devToolsConfig;
  return ReactFiberDevToolsHook.injectInternals({
    ...devToolsConfig,
    findHostInstanceByFiber(fiber: Fiber): Instance | TextInstance | null {
      const hostFiber = findCurrentHostFiber(fiber);
      if (hostFiber === null) {
        return null;
      }
      return hostFiber.stateNode;
    },
    findFiberByHostInstance(instance: Instance | TextInstance): Fiber | null {
      if (!findFiberByHostInstance) {
        // Might not be implemented by the renderer.
        return null;
      }
      return findFiberByHostInstance(instance);
    },
  });
}
