export const PROCESS_VM_FIELDS = [
  'name',
  'pid',
  'ppid',
  'parentName',
  'status',
  'type',
  'port',
  'cpu',
  'memory',
  'startTime',
  'command'
] as const

export type ProcessVmField = typeof PROCESS_VM_FIELDS[number]

export const PROCESS_VM_FIELD_LIST = PROCESS_VM_FIELDS.join('|')
