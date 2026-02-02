import { createVNode, render } from 'vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';

// 创建挂载容器
const container = document.createElement('div');
container.id = 'dialog-container';
document.body.appendChild(container);

function createDialog({ type, title, message, confirmText, cancelText }) {
  return new Promise((resolve, reject) => {
    // 1. 创建虚拟节点
    const vnode = createVNode(ConfirmDialog, {
      type,
      title,
      message,
      confirmText,
      cancelText,
      resolve: (result) => {
        // 销毁组件逻辑 (延迟一下让离开动画播完)
        // 注意：这里我们通过 props 传入 resolve，组件内部调用它
        resolve(result);
        // 稍后移除 DOM，保留动画时间
        setTimeout(() => {
            render(null, container);
        }, 500);
      },
      reject
    });

    // 2. 渲染到容器
    render(vnode, container);

    // 3. 触发组件内部的 show 方法以显示动画
    // 需要在 nextTick 或者渲染完成后调用，这里简单地通过组件 expose 的 show
    if (vnode.component && vnode.component.exposed) {
        vnode.component.exposed.show();
    }
  });
}

// 封装导出
export const $confirm = (message, title = 'Confirmation') => {
  return createDialog({ type: 'confirm', title, message });
};

export const $alert = (message, title = 'System Notice') => {
  return createDialog({ type: 'alert', title, message });
};