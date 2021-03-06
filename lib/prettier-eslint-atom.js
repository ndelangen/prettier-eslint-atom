/* global atom */
/* eslint no-console:0 */
// fix these:
/* eslint no-negated-condition:0 */
const path = require('path')
const findRoot = require('find-root')
const {allowUnsafeNewFunction} = require('loophole')

let formatPrettierESLint
allowUnsafeNewFunction(() => {
  // if you can figure out how to make this not be necessary, that'd be awesome
  // the culpret is the generate-function module which uses a form of `eval`
  // which is not allowed in Atom. :shrug:
  formatPrettierESLint = require('prettier-eslint') // eslint-disable-line global-require
})


module.exports = {
  style: null,
  fileTypes: ['.js', '.jsx', '.es6'],
  fileSupported(file) {
    // Ensure file is a supported file type.
    const ext = path.extname(file)
    return this.fileTypes.includes(ext)
  },
  activate() {
    this.commands = atom.commands.add('atom-workspace', 'prettier-eslint:format', () => {
      this.format()
    })

    this.editorObserver = atom.workspace.observeTextEditors(this.handleEvents.bind(this))
  },
  deactivate() {
    this.commands.dispose()
    this.editorObserver.dispose()
  },
  format(options) {
    /* eslint complexity:[2, 8] */
    // TODO: lower this...
    if (options === undefined) {
      options = {}
    }
    const selection = typeof options.selection === 'undefined' ? true : !!options.selection
    const editor = atom.workspace.getActiveTextEditor()
    if (!editor) {
      // Return if the current active item is not a `TextEditor`
      return
    }
    const {
      buffer: {
        file: {path: filePath} = {},
      } = {},
    } = editor
    const selectedText = selection ? editor.getSelectedText() : null
    const text = selectedText || editor.getText()
    const cursorPosition = editor.getCursorScreenPosition()

    let transformed
    allowUnsafeNewFunction(() => {
      try {
        // please someone figure out how I can avoid
        // needing to wrap this in allowUnsafeNewFunction!
        transformed = formatPrettierESLint({
          text,
          filePath,
        })
      } catch (error) {
        console.error('prettier-eslint-atom error:', error.stack)
      }
    })

    if (selectedText) {
      editor.setTextInBufferRange(editor.getSelectedBufferRange(), transformed)
    } else {
      editor.setText(transformed)
    }
    editor.setCursorScreenPosition(cursorPosition)
  },
  handleEvents(editor) {
    editor.getBuffer().onWillSave(() => {
      const editorPath = editor.getPath()
      if (!editorPath) {
        return
      }

      if (!editor.getBuffer().isModified()) {
        return
      }

      const formatOnSave = atom.config.get('prettier-atom.formatOnSave', {scope: editor.getRootScopeDescriptor()})
      if (!formatOnSave) {
        return
      }

      // Set the relative path based on the file's nearest package.json.
      // If no package.json is found, use path verbatim.
      let relativePath
      try {
        const projectPath = findRoot(editorPath)
        relativePath = editorPath.replace(projectPath, '').substring(1)
      } catch (e) {
        relativePath = editorPath
      }

      if (this.fileSupported(relativePath)) {
        this.format({selection: false})
      }
    })
  },
  config: {
    formatOnSave: {type: 'boolean', default: false, order: 1},
  },
}
