import {
  App,
  VNode,
  createVNode,
  ssrUtils,
  createApp,
  ssrContextKey
} from 'vue'
import { isString, isPromise } from '@vue/shared'
import { renderComponentVNode, SSRBuffer, SSRContext } from './render'
import { Readable } from 'stream'

const { isVNode } = ssrUtils

async function unrollBuffer(
  buffer: SSRBuffer,
  stream: Readable
): Promise<void> {
  for (let i = 0; i < buffer.length; i++) {
    let item = buffer[i]
    if (isPromise(item)) {
      item = await item
    }
    if (isString(item)) {
      stream.push(item)
    } else {
      await unrollBuffer(item, stream)
    }
  }
}

export function renderToStream(
  input: App | VNode,
  context: SSRContext = {}
): Readable {
  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderToStream(createApp({ render: () => input }), context)
  }

  // rendering an app
  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)

  const stream = new Readable()

  Promise.resolve(renderComponentVNode(vnode))
    .then(buffer => unrollBuffer(buffer, stream))
    .then(() => {
      stream.push(null)
    })
    .catch(error => {
      stream.destroy(error)
    })

  return stream
}
