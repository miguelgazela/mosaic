export interface Command {
  label: string
  do(): void
  undo(): void
}

export function batch(label: string, cmds: Command[]): Command {
  return {
    label,
    do: () => cmds.forEach((c) => c.do()),
    undo: () => [...cmds].reverse().forEach((c) => c.undo()),
  }
}

export class UndoStack {
  private undos: Command[] = []
  private redos: Command[] = []

  constructor(private limit = 200) {}

  /** Run a command and record it. */
  exec(c: Command): void {
    c.do()
    this.push(c)
  }

  /** Record a command that has already been applied (e.g. after a live drag). */
  push(c: Command): void {
    this.undos.push(c)
    if (this.undos.length > this.limit) this.undos.shift()
    this.redos.length = 0
  }

  undo(): Command | null {
    const c = this.undos.pop()
    if (!c) return null
    c.undo()
    this.redos.push(c)
    return c
  }

  redo(): Command | null {
    const c = this.redos.pop()
    if (!c) return null
    c.do()
    this.undos.push(c)
    return c
  }

  get canUndo(): boolean { return this.undos.length > 0 }
  get canRedo(): boolean { return this.redos.length > 0 }

  clear(): void {
    this.undos.length = 0
    this.redos.length = 0
  }
}
