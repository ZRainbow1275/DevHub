<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Editor } from '@tiptap/core'
import { Columns3, Combine, Merge, PanelTop, Plus, Rows3, Split, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  editor: Editor | undefined
}>()

const visible = ref(false)
const toolbarStyle = ref({ top: '0px', left: '0px' })
const toolbarEl = ref<HTMLElement | null>(null)

const TOOLBAR_GAP = 10
const EDGE_PADDING = 10

function runTableCommand(command: () => boolean): void {
  if (!props.editor) {
    return
  }

  command()
  props.editor.chain().focus().run()
  nextTick(updateToolbar)
}

function updateToolbar(): void {
  const editor = props.editor
  if (!editor?.view || !editor.isActive('table')) {
    visible.value = false
    return
  }

  try {
    const { from } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    const paperEl = toolbarEl.value?.closest('.editor-paper')
      ?? editor.view.dom.closest('.editor-paper')
      ?? editor.view.dom.parentElement

    if (!paperEl) {
      visible.value = false
      return
    }

    const paperRect = paperEl.getBoundingClientRect()
    const toolbarWidth = toolbarEl.value?.offsetWidth ?? 520
    const toolbarHeight = toolbarEl.value?.offsetHeight ?? 42
    const halfWidth = toolbarWidth / 2
    let top = coords.top - paperRect.top - toolbarHeight - TOOLBAR_GAP
    if (top < EDGE_PADDING) {
      top = coords.bottom - paperRect.top + TOOLBAR_GAP
    }

    const minLeft = halfWidth + EDGE_PADDING
    const maxLeft = paperRect.width - halfWidth - EDGE_PADDING
    let left = coords.left - paperRect.left
    if (minLeft < maxLeft) {
      left = Math.max(minLeft, Math.min(maxLeft, left))
    }

    toolbarStyle.value = {
      top: `${Math.max(EDGE_PADDING, top)}px`,
      left: `${left}px`,
    }
    visible.value = true
  } catch {
    visible.value = false
  }
}

let unsubscribe: (() => void) | null = null

function attachListeners(editor: Editor): void {
  detachListeners()

  const onUpdate = () => nextTick(updateToolbar)
  const onBlur = () => {
    window.setTimeout(() => {
      if (!editor.isFocused) {
        visible.value = false
      }
    }, 160)
  }

  editor.on('selectionUpdate', onUpdate)
  editor.on('transaction', onUpdate)
  editor.on('blur', onBlur)

  unsubscribe = () => {
    editor.off('selectionUpdate', onUpdate)
    editor.off('transaction', onUpdate)
    editor.off('blur', onBlur)
  }
}

function detachListeners(): void {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}

watch(
  () => props.editor,
  (editor) => {
    detachListeners()
    if (editor) {
      attachListeners(editor)
      nextTick(updateToolbar)
    }
  },
  { immediate: true },
)

onBeforeUnmount(detachListeners)
</script>

<template>
  <div
    v-show="visible"
    ref="toolbarEl"
    class="table-floating-toolbar"
    :style="toolbarStyle"
    @mousedown.prevent
  >
    <button type="button" title="Add row above" @click="runTableCommand(() => editor?.chain().focus().addRowBefore().run() ?? false)">
      <Rows3 :size="15" />
      <Plus :size="12" />
    </button>
    <button type="button" title="Add row below" @click="runTableCommand(() => editor?.chain().focus().addRowAfter().run() ?? false)">
      <Rows3 :size="15" />
    </button>
    <button type="button" title="Delete row" @click="runTableCommand(() => editor?.chain().focus().deleteRow().run() ?? false)">
      <Rows3 :size="15" />
      <Trash2 :size="12" />
    </button>
    <span class="toolbar-divider" />
    <button type="button" title="Add column before" @click="runTableCommand(() => editor?.chain().focus().addColumnBefore().run() ?? false)">
      <Columns3 :size="15" />
      <Plus :size="12" />
    </button>
    <button type="button" title="Add column after" @click="runTableCommand(() => editor?.chain().focus().addColumnAfter().run() ?? false)">
      <Columns3 :size="15" />
    </button>
    <button type="button" title="Delete column" @click="runTableCommand(() => editor?.chain().focus().deleteColumn().run() ?? false)">
      <Columns3 :size="15" />
      <Trash2 :size="12" />
    </button>
    <span class="toolbar-divider" />
    <button type="button" title="Toggle header row" @click="runTableCommand(() => editor?.chain().focus().toggleHeaderRow().run() ?? false)">
      <PanelTop :size="15" />
    </button>
    <button type="button" title="Merge cells" @click="runTableCommand(() => editor?.chain().focus().mergeCells().run() ?? false)">
      <Merge :size="15" />
    </button>
    <button type="button" title="Split cell" @click="runTableCommand(() => editor?.chain().focus().splitCell().run() ?? false)">
      <Split :size="15" />
    </button>
    <button type="button" title="Delete table" class="danger" @click="runTableCommand(() => editor?.chain().focus().deleteTable().run() ?? false)">
      <Combine :size="15" />
      <Trash2 :size="12" />
    </button>
  </div>
</template>

<style scoped>
.table-floating-toolbar {
  position: absolute;
  z-index: 28;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(31, 41, 55, 0.12);
  border-radius: 12px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
  transform: translateX(-50%);
  backdrop-filter: blur(10px);
}

.table-floating-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  color: #4b5563;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.table-floating-toolbar button:hover {
  color: #d32f2f;
  background: #fff1f2;
}

.table-floating-toolbar button.danger:hover {
  color: #b91c1c;
  background: #fee2e2;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(31, 41, 55, 0.12);
}
</style>
