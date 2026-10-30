import { supabase } from '../../lib/supabase'
import type { TaskRow } from './group'

export const TASKS_KEY = ['tasks'] as const

export async function fetchTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase.rpc('tasks')
  if (error) throw error
  return (data ?? []) as TaskRow[]
}

export async function setTaskDone(elementId: string, itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_task_done', { p_element: elementId, p_item: itemId, p_done: done })
  if (error) throw error
}

/** `due` is an ISO day, or null to clear it. */
export async function setTaskDue(elementId: string, itemId: string, due: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_task_due', { p_element: elementId, p_item: itemId, p_due: due })
  if (error) throw error
}
