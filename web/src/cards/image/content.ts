import type { CanvasElement } from '../../canvas/types'

export interface ImageContent {
  path?: string
  thumbPath?: string
  w: number
  h: number
  caption: string
  name: string
  bytes: number
}

export function readImage(c: CanvasElement['content']): ImageContent {
  return {
    path: typeof c.path === 'string' ? c.path : undefined,
    thumbPath: typeof c.thumbPath === 'string' ? c.thumbPath : undefined,
    w: typeof c.w === 'number' && c.w > 0 ? c.w : 3,
    h: typeof c.h === 'number' && c.h > 0 ? c.h : 2,
    caption: typeof c.caption === 'string' ? c.caption : '',
    name: typeof c.name === 'string' ? c.name : 'Image',
    bytes: typeof c.bytes === 'number' ? c.bytes : 0,
  }
}
